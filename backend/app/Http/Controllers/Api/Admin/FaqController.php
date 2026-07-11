<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FaqController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Faq::query()->orderBy('group')->orderBy('sort_order')->get()]);
    }

    public function store(Request $request)
    {
        return response()->json(Faq::query()->create($this->validatePayload($request)), 201);
    }

    public function update(Request $request, Faq $faq)
    {
        $faq->update($this->validatePayload($request));

        return response()->json($faq->refresh());
    }

    public function destroy(Faq $faq)
    {
        $faq->delete();

        return response()->json(['message' => 'FAQ deleted.']);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'group' => ['required', 'string', 'max:100'],
            'question' => ['required', 'string', 'max:500'],
            'answer' => ['required', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'status' => ['required', Rule::in(['draft', 'published'])],
        ]);
    }
}
