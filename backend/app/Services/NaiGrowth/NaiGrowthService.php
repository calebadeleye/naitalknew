<?php

namespace App\Services\NaiGrowth;

use App\Models\NaiGrowthEmailDraft;
use App\Models\NaiGrowthMessage;
use App\Models\User;
use InvalidArgumentException;

class NaiGrowthService
{
    private const HISTORY_TURNS = 20;

    public function __construct(
        private readonly NaiGrowthContextBuilder $contextBuilder,
        private readonly GeminiClient $gemini,
        private readonly NaiGrowthToolExecutor $tools,
    ) {
    }

    public function history(User $user): array
    {
        return NaiGrowthMessage::query()
            ->where('user_id', $user->id)
            ->oldest('id')
            ->get(['role', 'content', 'actions_taken', 'sources', 'created_at'])
            ->toArray();
    }

    public function reply(User $user, string $userMessage): array
    {
        $history = NaiGrowthMessage::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(self::HISTORY_TURNS)
            ->get(['role', 'content'])
            ->reverse()
            ->values()
            ->map(fn (NaiGrowthMessage $message) => ['role' => $message->role, 'content' => $message->content])
            ->all();

        NaiGrowthMessage::query()->create([
            'user_id' => $user->id,
            'role' => 'user',
            'content' => $userMessage,
        ]);

        $facts = $this->contextBuilder->build();
        $systemPrompt = $this->systemPrompt($facts);

        $result = $this->gemini->generateReply(
            $systemPrompt,
            $history,
            $userMessage,
            $this->toolDeclarations(),
            fn (string $name, array $args) => $this->dispatchTool($user, $name, $args),
        );

        $assistantMessage = NaiGrowthMessage::query()->create([
            'user_id' => $user->id,
            'role' => 'assistant',
            'content' => $result['reply'],
            'facts_snapshot' => $facts,
            'actions_taken' => $result['actions'] ?: null,
            'sources' => $result['sources'] ?: null,
        ]);

        $this->linkDraftedEmails($result['actions'], $assistantMessage->id);

        return [
            'reply' => $result['reply'],
            'facts' => $facts,
            'actions_taken' => $result['actions'],
            'sources' => $result['sources'],
            'created_at' => $assistantMessage->created_at,
        ];
    }

    /**
     * Stamps naigrowth_message_id onto any email draft(s) created this turn,
     * so the Approval Queue can trace a draft back to the conversation that
     * produced it. draftEmail() itself doesn't know the message id yet since
     * the assistant message isn't saved until after the tool call runs.
     */
    private function linkDraftedEmails(array $actions, int $assistantMessageId): void
    {
        $draftIds = collect($actions)
            ->where('tool', 'draft_email')
            ->pluck('result.draft_id')
            ->filter()
            ->all();

        if ($draftIds !== []) {
            NaiGrowthEmailDraft::query()->whereIn('id', $draftIds)->update(['naigrowth_message_id' => $assistantMessageId]);
        }
    }

    public function clear(User $user): void
    {
        NaiGrowthMessage::query()->where('user_id', $user->id)->delete();
    }

    /**
     * @return array{summary: string}
     */
    private function dispatchTool(User $user, string $name, array $args): array
    {
        return match ($name) {
            'update_lead_status' => $this->tools->updateLeadStatus(
                (int) ($args['lead_id'] ?? 0),
                (string) ($args['status'] ?? ''),
            ),
            'add_client_note' => $this->tools->addClientNote(
                (int) ($args['client_id'] ?? 0),
                (string) ($args['note'] ?? ''),
            ),
            'draft_email' => $this->tools->draftEmail(
                $user->id,
                (string) ($args['recipient_email'] ?? ''),
                $args['recipient_name'] ?? null,
                (string) ($args['subject'] ?? ''),
                (string) ($args['body'] ?? ''),
            ),
            default => throw new InvalidArgumentException("Unknown tool: {$name}"),
        };
    }

    private function toolDeclarations(): array
    {
        return [
            [
                'functionDeclarations' => [
                    [
                        'name' => 'update_lead_status',
                        'description' => 'Update a website-quote lead\'s pipeline status in Naitalk\'s CRM. Use the lead\'s real id from the CURRENT NAITALK DATA block.',
                        'parameters' => [
                            'type' => 'object',
                            'properties' => [
                                'lead_id' => ['type' => 'integer', 'description' => 'The lead\'s id from lead_pipeline.recent.'],
                                'status' => [
                                    'type' => 'string',
                                    'enum' => ['new', 'contacted', 'qualified', 'quoted', 'converted', 'closed', 'spam'],
                                ],
                            ],
                            'required' => ['lead_id', 'status'],
                        ],
                    ],
                    [
                        'name' => 'add_client_note',
                        'description' => 'Append an internal (staff-only, never client-visible) note to a client\'s record. Use the client\'s real id from the CURRENT NAITALK DATA block.',
                        'parameters' => [
                            'type' => 'object',
                            'properties' => [
                                'client_id' => ['type' => 'integer', 'description' => 'The client\'s id from top_clients_by_lifetime_payments or cross_sell_candidates.'],
                                'note' => ['type' => 'string', 'description' => 'The note text to record.'],
                            ],
                            'required' => ['client_id', 'note'],
                        ],
                    ],
                    [
                        'name' => 'draft_email',
                        'description' => 'Draft an email and place it in the Approval Queue for the owner to review. This NEVER sends anything -- it only creates a pending draft an admin must explicitly approve.',
                        'parameters' => [
                            'type' => 'object',
                            'properties' => [
                                'recipient_email' => ['type' => 'string', 'description' => 'The recipient\'s real email address, e.g. from a lead or client record.'],
                                'recipient_name' => ['type' => 'string', 'description' => 'The recipient\'s name, for display in the Approval Queue.'],
                                'subject' => ['type' => 'string'],
                                'body' => ['type' => 'string', 'description' => 'The full email body as plain text.'],
                            ],
                            'required' => ['recipient_email', 'subject', 'body'],
                        ],
                    ],
                ],
            ],
            ['googleSearch' => (object) []],
        ];
    }

    private function systemPrompt(array $facts): string
    {
        $basePrompt = require resource_path('prompts/naigrowth_system_prompt.php');
        $factsJson = json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        return $basePrompt."\n\n==================================================\nCURRENT NAITALK DATA (FACTS as of {$facts['generated_at']})\n==================================================\n\n{$factsJson}";
    }
}
