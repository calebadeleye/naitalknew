<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HelpAssistantQuestion extends Model
{
    protected $fillable = [
        'client_id',
        'question',
        'answered_from_knowledge_base',
        'article_slugs',
        'used_fallback',
    ];

    protected function casts(): array
    {
        return [
            'answered_from_knowledge_base' => 'boolean',
            'article_slugs' => 'array',
            'used_fallback' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
