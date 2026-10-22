<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** An email snoozed into the "Snoozed" folder until a chosen time. */
class GreenmailSnooze extends Model
{
    protected $fillable = ['owner_email', 'password_encrypted', 'message_id', 'subject', 'from_email', 'return_folder', 'until', 'status', 'error'];

    protected $hidden = ['owner_email', 'password_encrypted'];

    protected function casts(): array
    {
        return ['until' => 'datetime'];
    }
}
