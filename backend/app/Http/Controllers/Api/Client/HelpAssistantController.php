<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Services\HelpAssistant\ClientHelpAssistant;
use Illuminate\Http\Request;

class HelpAssistantController extends Controller
{
    public function __invoke(Request $request, ClientHelpAssistant $assistant)
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:1000'],
            // The widget keeps the conversation itself; only recent turns are sent back.
            'history' => ['sometimes', 'array', 'max:8'],
            'history.*.role' => ['required_with:history', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:2000'],
        ]);

        $result = $assistant->answer($request->user()->client, $validated['message'], $validated['history'] ?? []);

        return response()->json([
            'reply' => $result['reply'],
            'articles' => array_map(fn (array $article) => $article + ['url' => '/knowledge-base/'.$article['slug']], $result['articles']),
        ]);
    }
}
