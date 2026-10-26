<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One participant leaving a room: how long they were in it. Keyed by LiveKit's event id. */
class NaitalkCallUsageEvent extends Model
{
    protected $fillable = ['tenant_id', 'event_id', 'room_name', 'participant_identity', 'seconds', 'left_at'];

    protected function casts(): array
    {
        return ['left_at' => 'datetime', 'seconds' => 'integer'];
    }
}
