<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/** The mailbox's own calendar: events in a date range, add / change / remove. */
class CalendarController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after:from'],
        ]);
        $from = Carbon::parse($data['from']);
        $to = Carbon::parse($data['to']);
        abort_if($from->diffInDays($to) > 120, 422, 'Ask for at most 120 days at a time.');

        $events = GreenmailEvent::query()
            ->where('owner_email', $this->owner($request))
            // Anything that overlaps the range, including events that started before it.
            ->where('starts_at', '<', $to)
            ->where(fn ($query) => $query->where('ends_at', '>', $from)->orWhere(fn ($q) => $q->whereNull('ends_at')->where('starts_at', '>=', $from)))
            ->orderBy('starts_at')
            ->get();

        return response()->json(['events' => $events]);
    }

    public function store(Request $request)
    {
        $event = GreenmailEvent::query()->create($this->validated($request) + ['owner_email' => $this->owner($request)]);

        return response()->json(['event' => $event], 201);
    }

    public function update(Request $request, GreenmailEvent $event)
    {
        abort_unless($event->owner_email === $this->owner($request), 404);
        $event->update($this->validated($request));

        return response()->json(['event' => $event]);
    }

    public function destroy(Request $request, GreenmailEvent $event)
    {
        abort_unless($event->owner_email === $this->owner($request), 404);
        $event->delete();

        return response()->json(['message' => 'Event deleted.']);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'all_day' => ['nullable', 'boolean'],
            'location' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ], ['ends_at.after_or_equal' => 'The event must end after it starts.']);

        // Stored in UTC; the browser sends times with its own offset.
        $data['starts_at'] = Carbon::parse($data['starts_at'])->utc();
        $data['ends_at'] = isset($data['ends_at']) ? Carbon::parse($data['ends_at'])->utc() : null;
        $data['all_day'] = (bool) ($data['all_day'] ?? false);

        return $data;
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
