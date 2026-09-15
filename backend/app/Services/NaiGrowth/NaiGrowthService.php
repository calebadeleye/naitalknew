<?php

namespace App\Services\NaiGrowth;

use App\Models\NaiGrowthMessage;
use App\Models\User;

class NaiGrowthService
{
    private const HISTORY_TURNS = 20;

    public function __construct(
        private readonly NaiGrowthContextBuilder $contextBuilder,
        private readonly GeminiClient $gemini,
    ) {
    }

    public function history(User $user): array
    {
        return NaiGrowthMessage::query()
            ->where('user_id', $user->id)
            ->oldest('id')
            ->get(['role', 'content', 'created_at'])
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

        $reply = $this->gemini->generateReply($systemPrompt, $history, $userMessage);

        $assistantMessage = NaiGrowthMessage::query()->create([
            'user_id' => $user->id,
            'role' => 'assistant',
            'content' => $reply,
            'facts_snapshot' => $facts,
        ]);

        return ['reply' => $reply, 'facts' => $facts, 'created_at' => $assistantMessage->created_at];
    }

    public function clear(User $user): void
    {
        NaiGrowthMessage::query()->where('user_id', $user->id)->delete();
    }

    private function systemPrompt(array $facts): string
    {
        $basePrompt = require resource_path('prompts/naigrowth_system_prompt.php');
        $factsJson = json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        return $basePrompt."\n\n==================================================\nCURRENT NAITALK DATA (FACTS as of {$facts['generated_at']})\n==================================================\n\n{$factsJson}";
    }
}
