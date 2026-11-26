<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailCampaign;
use App\Models\Greenmail\GreenmailContact;
use App\Models\Greenmail\GreenmailSetting;
use App\Models\Greenmail\GreenmailUnsubscribe;
use App\Services\Greenmail\Campaigns;
use App\Services\Greenmail\CampaignTracking;
use App\Services\Greenmail\HtmlSanitizer;
use App\Services\Greenmail\MailSender;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

/**
 * Campaigns: one email, sent separately to each person on a list (so nobody
 * sees anyone else's address), personalised with {{name}}, {{first_name}} and
 * {{email}}, with an unsubscribe link. The scheduler sends a few a minute.
 */
class CampaignController extends Controller
{
    public function index(Request $request)
    {
        $campaigns = GreenmailCampaign::query()->where('owner_email', $this->owner($request))->latest()->limit(100)
            ->withCount(['recipients as opened_count' => fn ($q) => $q->whereNotNull('opened_at'), 'recipients as clicked_count' => fn ($q) => $q->whereNotNull('clicked_at')])
            ->get()
            ->map(fn (GreenmailCampaign $campaign) => $this->present($campaign, withBody: false));

        return response()->json(['campaigns' => $campaigns, 'limits' => $this->limits()]);
    }

    public function show(Request $request, GreenmailCampaign $campaign)
    {
        $this->authorizeOwner($request, $campaign);

        return response()->json(['campaign' => $this->present($campaign) + [
            'recipients' => $campaign->recipients()->orderBy('id')->limit(2000)->get(['id', 'email', 'name', 'status', 'error', 'sent_at', 'opened_at', 'open_count', 'clicked_at', 'click_count', 'unsubscribed_at']),
            'report' => app(CampaignTracking::class)->report($campaign),
        ]]);
    }

    public function store(Request $request, HtmlSanitizer $sanitizer)
    {
        $owner = $this->owner($request);
        $data = $this->validated($request, $sanitizer, $owner);

        $campaign = DB::transaction(function () use ($data, $owner) {
            $campaign = GreenmailCampaign::query()->create(collect($data)->except('recipients')->all() + ['owner_email' => $owner, 'status' => 'draft']);
            $this->replaceRecipients($campaign, $data['recipients']);

            return $campaign;
        });

        return response()->json(['campaign' => $this->present($campaign->fresh()), 'message' => 'Campaign saved as a draft.'], 201);
    }

    public function update(Request $request, GreenmailCampaign $campaign, HtmlSanitizer $sanitizer)
    {
        $this->authorizeOwner($request, $campaign);
        abort_unless($campaign->status === 'draft', 422, 'Only a draft can be changed.');
        $data = $this->validated($request, $sanitizer, $campaign->owner_email);

        DB::transaction(function () use ($campaign, $data) {
            $campaign->update(collect($data)->except('recipients')->all());
            $this->replaceRecipients($campaign, $data['recipients']);
        });

        return response()->json(['campaign' => $this->present($campaign->fresh()), 'message' => 'Campaign saved.']);
    }

    /** Start sending now, or at send_at. */
    public function send(Request $request, GreenmailCampaign $campaign)
    {
        $this->authorizeOwner($request, $campaign);
        abort_unless($campaign->status === 'draft', 422, 'This campaign has already been sent.');
        abort_if($campaign->total === 0, 422, 'Add at least one recipient.');

        $sendAt = $request->validate(['send_at' => ['nullable', 'date', 'after:now', 'before:+1 year']], ['send_at.after' => 'Pick a time in the future.'])['send_at'] ?? null;
        $session = $request->attributes->get('greenmail_session');

        $campaign->update([
            'status' => 'sending',
            'send_at' => $sendAt ? Carbon::parse($sendAt)->utc() : now(),
            'password_encrypted' => Crypt::encryptString($session->password()),
            'last_error' => null,
        ]);

        return response()->json([
            'campaign' => $this->present($campaign->fresh()),
            'message' => $sendAt
                ? 'Campaign scheduled for '.Carbon::parse($sendAt)->diffForHumans().'.'
                : "Campaign started. {$campaign->total} ".($campaign->total === 1 ? 'email goes' : 'emails go').' out over about '.$this->duration($campaign->total).'.',
        ]);
    }

    /** Send again to the recipients that failed (e.g. after the mail server's hourly limit). */
    public function retry(Request $request, GreenmailCampaign $campaign)
    {
        $this->authorizeOwner($request, $campaign);
        abort_if(in_array($campaign->status, ['draft', 'sending'], true), 422, 'This campaign is not finished yet.');
        $failed = $campaign->recipients()->where('status', 'failed');
        $count = (clone $failed)->count();
        abort_if($count === 0, 422, 'No emails in this campaign failed.');

        $failed->update(['status' => 'pending', 'error' => null]);
        $campaign->update([
            'status' => 'sending',
            'send_at' => now(),
            'failed_count' => max(0, $campaign->failed_count - $count),
            'password_encrypted' => Crypt::encryptString($request->attributes->get('greenmail_session')->password()),
            'finished_at' => null,
            'last_error' => null,
        ]);

        return response()->json([
            'campaign' => $this->present($campaign->fresh()),
            'message' => "Sending again to {$count} ".($count === 1 ? 'recipient' : 'recipients').' over about '.$this->duration($count).'.',
        ]);
    }

    /** Roughly how long a number of emails takes at the per-minute and hourly pace. */
    private function duration(int $emails): string
    {
        $perMinute = max(1, (int) config('greenmail.campaign_per_minute'));
        $perHour = max(1, min($perMinute * 60, (int) config('greenmail.campaign_hourly_limit')));
        $minutes = $emails <= $perHour ? (int) ceil($emails / $perMinute) : (int) ceil($emails / $perHour * 60);

        if ($minutes < 60) {
            return $minutes.' minute'.($minutes === 1 ? '' : 's');
        }
        $hours = (int) ceil($minutes / 60);

        return $hours.' hour'.($hours === 1 ? '' : 's');
    }

    /** Send one copy to yourself, personalised as the first recipient would see it. */
    public function test(Request $request, GreenmailCampaign $campaign, MailSender $sender, Campaigns $campaigns)
    {
        $this->authorizeOwner($request, $campaign);
        $session = $request->attributes->get('greenmail_session');
        $first = $campaign->recipients()->orderBy('id')->first();
        $settings = GreenmailSetting::query()->where('owner_email', $session->email)->first();

        try {
            $sender->send($session->email, $settings?->display_name, $session->password(), [
                'to' => [$session->email],
                'subject' => '[Test] '.$campaigns->personalise($campaign->subject, $first?->name, $first?->email ?? $session->email, html: false),
                'html' => $campaigns->personalise($campaign->body_html, $first?->name, $first?->email ?? $session->email).$campaigns->footer($session->email, null),
            ]);
        } catch (TransportExceptionInterface $exception) {
            report($exception);

            return response()->json(['message' => 'The test could not be sent. Please try again.'], 422);
        }

        return response()->json(['message' => "Test sent to {$session->email}."]);
    }

    /** Stop a campaign that is sending or waiting; what was sent stays sent. */
    public function cancel(Request $request, GreenmailCampaign $campaign)
    {
        $this->authorizeOwner($request, $campaign);
        abort_unless(in_array($campaign->status, ['sending', 'draft'], true), 422, 'This campaign has already finished.');

        $campaign->update(['status' => $campaign->sent_count > 0 ? 'cancelled' : 'draft', 'password_encrypted' => null, 'finished_at' => $campaign->sent_count > 0 ? now() : null]);

        return response()->json(['campaign' => $this->present($campaign->fresh()), 'message' => $campaign->sent_count > 0 ? "Campaign stopped after {$campaign->sent_count} emails." : 'Campaign stopped. It is a draft again.']);
    }

    public function destroy(Request $request, GreenmailCampaign $campaign)
    {
        $this->authorizeOwner($request, $campaign);
        abort_if($campaign->status === 'sending', 422, 'Stop the campaign before deleting it.');
        $campaign->delete();

        return response()->json(['message' => 'Campaign deleted.']);
    }

    private function validated(Request $request, HtmlSanitizer $sanitizer, string $owner): array
    {
        $max = (int) config('greenmail.campaign_max_recipients');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'subject' => ['required', 'string', 'max:300'],
            'body_html' => ['required', 'string', 'max:500000'],
            'recipients' => ['nullable', 'array', "max:{$max}"],
            'recipients.*.email' => ['required', 'email'],
            'recipients.*.name' => ['nullable', 'string', 'max:120'],
            'contact_ids' => ['nullable', 'array'],
            'contact_ids.*' => ['integer'],
            'all_contacts' => ['nullable', 'boolean'],
            'track' => ['nullable', 'boolean'],
        ], ['recipients.max' => "A campaign can go to at most {$max} people."]);

        $people = collect($data['recipients'] ?? []);
        $contacts = GreenmailContact::query()->where('owner_email', $owner)
            ->when(! ($data['all_contacts'] ?? false), fn ($query) => $query->whereIn('id', $data['contact_ids'] ?? [0]))
            ->get(['email', 'name']);
        $people = $people->concat($contacts->map(fn ($c) => ['email' => $c->email, 'name' => $c->name]))
            ->map(fn ($p) => ['email' => strtolower(trim($p['email'])), 'name' => filled($p['name'] ?? null) ? trim($p['name']) : null])
            ->reject(fn ($p) => $p['email'] === $owner)
            ->unique('email')
            ->values();

        abort_if($people->count() > $max, 422, "A campaign can go to at most {$max} people.");

        return [
            'name' => $data['name'],
            'subject' => $data['subject'],
            'body_html' => $sanitizer->clean($data['body_html']),
            'track' => (bool) ($data['track'] ?? true),
            'recipients' => $people->all(),
        ];
    }

    private function replaceRecipients(GreenmailCampaign $campaign, array $people): void
    {
        $campaign->recipients()->delete();
        foreach (array_chunk($people, 500) as $chunk) {
            $campaign->recipients()->insert(array_map(fn ($p) => $p + ['campaign_id' => $campaign->id, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()], $chunk));
        }
        $campaign->update(['total' => count($people)]);
    }

    private function present(GreenmailCampaign $campaign, bool $withBody = true): array
    {
        $data = $campaign->only(['id', 'name', 'subject', 'track', 'status', 'send_at', 'total', 'sent_count', 'failed_count', 'skipped_count', 'started_at', 'finished_at', 'last_error', 'created_at', 'updated_at']);
        // For the list: how many opened / clicked (withCount in index, else counted here).
        $data['opened_count'] = (int) ($campaign->opened_count ?? $campaign->recipients()->whereNotNull('opened_at')->count());
        $data['clicked_count'] = (int) ($campaign->clicked_count ?? $campaign->recipients()->whereNotNull('clicked_at')->count());

        if ($withBody) {
            $data['body_html'] = $campaign->body_html;
            $data['unsubscribed'] = GreenmailUnsubscribe::query()->where('owner_email', $campaign->owner_email)->count();
        }

        return $data;
    }

    private function limits(): array
    {
        return [
            'per_minute' => (int) config('greenmail.campaign_per_minute'),
            'per_day' => (int) config('greenmail.campaign_daily_limit'),
            'max_recipients' => (int) config('greenmail.campaign_max_recipients'),
        ];
    }

    private function authorizeOwner(Request $request, GreenmailCampaign $campaign): void
    {
        abort_unless($campaign->owner_email === $this->owner($request), 404);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
