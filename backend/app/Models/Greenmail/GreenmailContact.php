<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class GreenmailContact extends Model
{
    protected $fillable = ['owner_email', 'name', 'email', 'phone', 'company', 'notes'];

    protected $hidden = ['owner_email'];

    public function groups(): BelongsToMany
    {
        return $this->belongsToMany(GreenmailContactGroup::class, 'greenmail_contact_group_members', 'contact_id', 'group_id');
    }
}
