<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NaiGrowthEmailDraft extends Model
{
    protected $table = 'naigrowth_email_drafts';

    protected $fillable = [
        'created_by_user_id',
        'naigrowth_message_id',
        'recipient_email',
        'recipient_name',
        'recipient_type',
        'recipient_id',
        'subject',
        'body',
        'status',
        'reviewed_by_user_id',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}
