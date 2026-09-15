<?php

namespace App\Services\NaiGrowth;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeminiClient
{
    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    public function generateReply(string $systemPrompt, array $history, string $userMessage): string
    {
        $apiKey = (string) config('services.gemini.key');

        if ($apiKey === '') {
            throw new RuntimeException('GEMINI_API_KEY is not configured.');
        }

        $model = (string) config('services.gemini.model');

        $contents = collect($history)
            ->push(['role' => 'user', 'content' => $userMessage])
            ->map(fn (array $turn) => [
                'role' => $turn['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $turn['content']]],
            ])
            ->all();

        $response = Http::baseUrl('https://generativelanguage.googleapis.com/v1beta')
            ->withHeaders(['x-goog-api-key' => $apiKey])
            // NaiGrowth's system prompt plus the injected facts block is long, and a
            // full business-analysis reply routinely takes 20-25s to generate — the
            // default 30s client timeout has been observed cutting that close.
            ->timeout(60)
            ->post("/models/{$model}:generateContent", [
                'system_instruction' => ['parts' => [['text' => $systemPrompt]]],
                'contents' => $contents,
            ]);

        if ($response->failed()) {
            throw new RuntimeException($response->json('error.message') ?? 'Gemini request failed.');
        }

        $reply = $response->json('candidates.0.content.parts.0.text');

        if (! is_string($reply) || $reply === '') {
            throw new RuntimeException('Gemini returned an empty reply.');
        }

        return $reply;
    }
}
