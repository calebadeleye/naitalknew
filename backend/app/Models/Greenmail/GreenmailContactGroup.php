<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class GreenmailContactGroup extends Model
{
    protected $fillable = ['owner_email', 'name'];

    protected $hidden = ['owner_email'];

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(GreenmailContact::class, 'greenmail_contact_group_members', 'group_id', 'contact_id');
    }
}
