<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** One attachment in the attachment manager's index. */
class GreenmailAttachment extends Model
{
    protected $fillable = ['owner_email', 'folder', 'uid', 'part_index', 'message_id', 'name', 'extension', 'kind', 'mime', 'size', 'from_name', 'from_email', 'subject', 'sent_at', 'warning'];

    protected $hidden = ['owner_email'];

    protected function casts(): array
    {
        return ['uid' => 'integer', 'part_index' => 'integer', 'size' => 'integer', 'sent_at' => 'datetime'];
    }
}
