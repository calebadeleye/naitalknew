<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** How far the attachment index has got in one folder. */
class GreenmailAttachmentScan extends Model
{
    protected $fillable = ['owner_email', 'folder', 'highest_uid', 'lowest_uid', 'complete'];

    protected function casts(): array
    {
        return ['highest_uid' => 'integer', 'lowest_uid' => 'integer', 'complete' => 'boolean'];
    }
}
