<?php

namespace App\Models\Greenmail;

use Illuminate\Database\Eloquent\Model;

/** A copy of an attachment shared through an expiring link. */
class GreenmailSharedFile extends Model
{
    protected $fillable = ['owner_email', 'token', 'name', 'mime', 'size', 'path', 'downloads', 'max_downloads', 'expires_at', 'revoked_at'];

    protected $hidden = ['owner_email', 'path', 'token'];

    protected function casts(): array
    {
        return ['size' => 'integer', 'downloads' => 'integer', 'max_downloads' => 'integer', 'expires_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function isAvailable(): bool
    {
        return $this->revoked_at === null
            && $this->expires_at->isFuture()
            && ($this->max_downloads === null || $this->downloads < $this->max_downloads);
    }
}
