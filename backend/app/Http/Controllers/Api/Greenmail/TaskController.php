<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailTask;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The mailbox's to-do list. */
class TaskController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->validate(['status' => ['nullable', Rule::in(['open', 'done', 'all'])]])['status'] ?? 'open';

        $tasks = GreenmailTask::query()
            ->where('owner_email', $this->owner($request))
            ->when($status === 'open', fn ($query) => $query->where('done', false))
            ->when($status === 'done', fn ($query) => $query->where('done', true))
            // Overdue and soonest first; undated last; finished newest first.
            ->orderBy('done')
            ->orderByRaw('due_date is null')
            ->orderBy('due_date')
            ->orderByDesc('completed_at')
            ->orderBy('id')
            ->limit(500)
            ->get();

        return response()->json(['tasks' => $tasks]);
    }

    public function store(Request $request)
    {
        $task = GreenmailTask::query()->create($this->validated($request) + ['owner_email' => $this->owner($request)]);

        return response()->json(['task' => $task], 201);
    }

    public function update(Request $request, GreenmailTask $task)
    {
        abort_unless($task->owner_email === $this->owner($request), 404);
        $task->update($this->validated($request, partial: true));

        return response()->json(['task' => $task->fresh()]);
    }

    public function destroy(Request $request, GreenmailTask $task)
    {
        abort_unless($task->owner_email === $this->owner($request), 404);
        $task->delete();

        return response()->json(['message' => 'Task deleted.']);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $data = $request->validate([
            'title' => [$required, 'string', 'max:255'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'done' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        if (array_key_exists('done', $data)) {
            $data['done'] = (bool) $data['done'];
            $data['completed_at'] = $data['done'] ? now() : null;
        }

        return $data;
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
