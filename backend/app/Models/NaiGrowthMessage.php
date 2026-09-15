<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NaiGrowthMessage extends Model
{
    protected $table = 'naigrowth_messages';

    protected $fillable = [
        'user_id',
        'role',
        'content',
        'facts_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'facts_snapshot' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
