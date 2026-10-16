<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** A filter or automation rule; see App\Services\Greenmail\MailRules for how it runs. */
class GreenmailRule extends Model
{
    public const KINDS = ['filter', 'automation'];

    public const FIELDS = ['any', 'from', 'to', 'subject'];

    public const OPERATORS = ['contains', 'is', 'begins', 'ends'];

    /** Filters sort mail; automation acts on it. */
    public const ACTIONS = [
        'filter' => ['move', 'delete', 'mark_read', 'star'],
        'automation' => ['forward', 'auto_reply'],
    ];

    protected $fillable = ['owner_email', 'kind', 'name', 'field', 'operator', 'value', 'action', 'target', 'reply_subject', 'reply_text', 'active', 'position'];

    protected $hidden = ['owner_email'];

    protected function casts(): array
    {
        return ['active' => 'boolean', 'position' => 'integer'];
    }
}
