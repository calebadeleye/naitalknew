<?php

namespace App\Services\NaiGrowth;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Throwable;

class GeminiClient
{
    // Each round is one model call; a function-calling turn takes at least two
    // (the call, then the reply to its result), so 3 gives one retry of margin
    // while still guaranteeing the loop below terminates.
    private const MAX_TOOL_ROUNDS = 3;

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     * @param  array<int, array>  $tools  Gemini Tool entries, e.g. [['functionDeclarations' => [...]], ['googleSearch' => (object) []]]
     * @param  (callable(string, array): array)|null  $toolHandler  Executes one tool call, returns its result array, or throws.
     * @return array{reply: string, actions: array<int, array{tool: string, args: array, summary: string, result: array}>, sources: array<int, array{title: ?string, uri: ?string}>}
     */
    public function generateReply(
        string $systemPrompt,
        array $history,
        string $userMessage,
        array $tools = [],
        ?callable $toolHandler = null,
    ): array {
        $apiKey = (string) config('services.gemini.key');

        if ($apiKey === '') {
            throw new RuntimeException('GEMINI_API_KEY is not configured.');
        }

        $contents = collect($history)
            ->push(['role' => 'user', 'content' => $userMessage])
            ->map(fn (array $turn) => [
                'role' => $turn['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $turn['content']]],
            ])
            ->all();

        $actions = [];

        for ($round = 0; $round < self::MAX_TOOL_ROUNDS; $round++) {
            $response = $this->call($apiKey, $systemPrompt, $contents, $tools);
            $parts = $response->json('candidates.0.content.parts') ?? [];
            $functionCalls = array_values(array_filter($parts, fn (array $part) => isset($part['functionCall'])));

            if ($functionCalls === [] || ! $toolHandler) {
                $reply = $response->json('candidates.0.content.parts.0.text');

                if (! is_string($reply) || $reply === '') {
                    throw new RuntimeException('Gemini returned an empty reply.');
                }

                return ['reply' => $reply, 'actions' => $actions, 'sources' => $this->extractSources($response)];
            }

            $contents[] = ['role' => 'model', 'parts' => $parts];
            $responseParts = [];

            foreach ($functionCalls as $part) {
                $name = (string) $part['functionCall']['name'];
                $args = (array) ($part['functionCall']['args'] ?? []);

                try {
                    $result = $toolHandler($name, $args);
                    $actions[] = ['tool' => $name, 'args' => $args, 'summary' => $result['summary'] ?? 'Action completed.', 'result' => $result];
                    $responseParts[] = ['functionResponse' => ['name' => $name, 'response' => $result]];
                } catch (Throwable $exception) {
                    $responseParts[] = ['functionResponse' => ['name' => $name, 'response' => ['error' => $exception->getMessage()]]];
                }
            }

            $contents[] = ['role' => 'user', 'parts' => $responseParts];
        }

        throw new RuntimeException('NaiGrowth could not finish responding after several tool calls — please try again.');
    }

    /**
     * Google Search grounding sources for this turn, if any. Best-effort: an
     * unexpected shape here just means no source chips render, never a
     * failed reply -- sources are supplementary evidence, not correctness
     * -critical.
     *
     * @return array<int, array{title: ?string, uri: ?string}>
     */
    private function extractSources(Response $response): array
    {
        $chunks = $response->json('candidates.0.groundingMetadata.groundingChunks');

        if (! is_array($chunks)) {
            return [];
        }

        return collect($chunks)
            ->filter(fn ($chunk) => is_array($chunk))
            ->map(fn (array $chunk) => [
                'title' => $chunk['web']['title'] ?? null,
                'uri' => $chunk['web']['uri'] ?? null,
            ])
            ->filter(fn (array $source) => $source['uri'])
            ->values()
            ->all();
    }

    private function call(string $apiKey, string $systemPrompt, array $contents, array $tools): Response
    {
        $model = (string) config('services.gemini.model');

        $payload = [
            'system_instruction' => ['parts' => [['text' => $systemPrompt]]],
            'contents' => $contents,
        ];

        if ($tools !== []) {
            $payload['tools'] = $tools;
        }

        $response = Http::baseUrl('https://generativelanguage.googleapis.com/v1beta')
            ->withHeaders(['x-goog-api-key' => $apiKey])
            // NaiGrowth's system prompt plus the injected facts block is long, and a
            // full business-analysis reply routinely takes 20-25s to generate — the
            // default 30s client timeout has been observed cutting that close.
            ->timeout(60)
            ->post("/models/{$model}:generateContent", $payload);

        if ($response->failed()) {
            throw new RuntimeException($response->json('error.message') ?? 'Gemini request failed.');
        }

        return $response;
    }
}
