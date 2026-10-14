<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportTicketMessage extends Model
{
    protected $fillable = [
        'support_ticket_id',
        'user_id',
        'author_type',
        'body',
        'attachments',
    ];

    /** Storage paths stay server-side; the API only ever sees names and sizes. */
    protected $hidden = ['attachments'];

    protected $appends = ['files'];

    protected function casts(): array
    {
        return ['attachments' => 'array'];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getFilesAttribute(): array
    {
        return collect($this->attachments ?? [])
            ->values()
            ->map(fn (array $file, int $index) => ['index' => $index, 'name' => $file['name'], 'size' => $file['size']])
            ->all();
    }
}
