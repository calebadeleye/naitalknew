<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailRule;
use App\Services\Greenmail\MailGateway;
use App\Services\Greenmail\MailRules;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Filters (move, delete, mark read, star) and automation rules (forward a
 * copy, auto-reply). Every change is compiled into the mailbox's server-side
 * Sieve script, so rules run on arriving mail even when Green Mail is closed.
 */
class RuleController extends Controller
{
    private const SAVED = 'Rule saved. It applies to new mail within a minute.';

    public function index(Request $request)
    {
        $kind = $request->validate(['kind' => ['required', Rule::in(GreenmailRule::KINDS)]])['kind'];

        $rules = GreenmailRule::query()->where('owner_email', $this->owner($request))->where('kind', $kind)->orderBy('position')->orderBy('id')->get();

        return response()->json(['rules' => $rules]);
    }

    public function store(Request $request, MailRules $compiler)
    {
        $owner = $this->owner($request);
        $data = $this->validated($request, $owner);

        abort_if(GreenmailRule::query()->where('owner_email', $owner)->where('kind', $data['kind'])->count() >= (int) config('greenmail.max_rules'), 422, 'You have reached the most rules a mailbox can have.');

        $rule = DB::transaction(function () use ($data, $owner, $compiler) {
            $rule = GreenmailRule::query()->create($data + [
                'owner_email' => $owner,
                'position' => (int) GreenmailRule::query()->where('owner_email', $owner)->max('position') + 1,
            ]);
            $compiler->sync($owner); // a failure here rolls the rule back

            return $rule;
        });

        return response()->json(['rule' => $rule->fresh(), 'message' => self::SAVED], 201);
    }

    public function update(Request $request, GreenmailRule $rule, MailRules $compiler)
    {
        $owner = $this->owner($request);
        abort_unless($rule->owner_email === $owner, 404);

        // Just switching it on or off.
        if ($request->has('active') && ! $request->has('field')) {
            $data = $request->validate(['active' => ['required', 'boolean']]);
        } else {
            $data = $this->validated($request, $owner, $rule->kind);
        }

        DB::transaction(function () use ($rule, $data, $compiler, $owner) {
            $rule->update($data);
            $compiler->sync($owner);
        });

        return response()->json(['rule' => $rule->fresh(), 'message' => $rule->active ? self::SAVED : 'Rule paused.']);
    }

    public function destroy(Request $request, GreenmailRule $rule, MailRules $compiler)
    {
        $owner = $this->owner($request);
        abort_unless($rule->owner_email === $owner, 404);

        DB::transaction(function () use ($rule, $compiler, $owner) {
            $rule->delete();
            $compiler->sync($owner);
        });

        return response()->json(['message' => 'Rule deleted.']);
    }

    private function validated(Request $request, string $owner, ?string $kind = null): array
    {
        $kind ??= (string) $request->input('kind');
        $data = $request->validate([
            'kind' => [$kind ? 'nullable' : 'required', Rule::in(GreenmailRule::KINDS)],
            'name' => ['nullable', 'string', 'max:120'],
            'field' => ['required', Rule::in(GreenmailRule::FIELDS)],
            'operator' => ['nullable', Rule::in(GreenmailRule::OPERATORS)],
            'value' => ['nullable', 'required_unless:field,any', 'string', 'max:200'],
            'action' => ['required', Rule::in(GreenmailRule::ACTIONS[$kind] ?? [])],
            'target' => ['nullable', 'string', 'max:200'],
            'reply_subject' => ['nullable', 'string', 'max:200'],
            'reply_text' => ['nullable', 'required_if:action,auto_reply', 'string', 'max:4000'],
            'active' => ['nullable', 'boolean'],
        ], [
            'value.required_unless' => 'Say what to look for.',
            'reply_text.required_if' => 'Write the reply to send.',
        ]);

        $data['kind'] = $kind;
        $data['operator'] ??= 'contains';
        $data['active'] = (bool) ($data['active'] ?? true);
        $data['value'] = $data['field'] === 'any' ? null : trim((string) $data['value']);

        if ($data['action'] === 'move') {
            $folders = collect(app(MailGateway::class)->folders())->pluck('path');
            if (! $folders->contains($data['target'])) {
                throw ValidationException::withMessages(['target' => 'Choose a folder to move the mail to.']);
            }
        } elseif ($data['action'] === 'forward') {
            $target = strtolower(trim((string) ($data['target'] ?? '')));
            if (! filter_var($target, FILTER_VALIDATE_EMAIL) || $target === $owner) {
                throw ValidationException::withMessages(['target' => 'Enter the address to forward a copy to.']);
            }
            $data['target'] = $target;
        } else {
            $data['target'] = null;
        }

        if ($data['action'] !== 'auto_reply') {
            $data['reply_subject'] = $data['reply_text'] = null;
        }

        $data['name'] = filled($data['name'] ?? null) ? $data['name'] : $this->describe($data);

        return $data;
    }

    /** "From contains acme.com → Move to Receipts" when the person gives no name. */
    private function describe(array $data): string
    {
        $when = $data['field'] === 'any' ? 'Every email' : ucfirst($data['field']).' '.str_replace(['begins', 'ends'], ['begins with', 'ends with'], $data['operator']).' “'.$data['value'].'”';
        $then = match ($data['action']) {
            'move' => 'Move to '.$data['target'],
            'delete' => 'Delete',
            'mark_read' => 'Mark as read',
            'star' => 'Star',
            'forward' => 'Forward a copy to '.$data['target'],
            default => 'Auto-reply',
        };

        return mb_substr("{$when} → {$then}", 0, 120);
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
