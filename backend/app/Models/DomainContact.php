<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DomainContact extends Model
{
    protected $fillable = [
        'client_id',
        'full_name',
        'company_name',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'country',
        'postal_code',
        'provider_contact_id',
    ];

    /**
     * Fields Spaceship (and most registries) require before a domain can be
     * registered or transferred. Used both by validation and by the
     * "is this contact complete" checkout gate.
     */
    public const REQUIRED_FIELDS = [
        'full_name', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function isComplete(): bool
    {
        foreach (self::REQUIRED_FIELDS as $field) {
            if (empty($this->{$field})) {
                return false;
            }
        }

        return true;
    }
}
