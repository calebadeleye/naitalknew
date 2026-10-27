<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * One app on Naitalk Call (Cradle, a website…), owned by a client account,
 * which is who signs up and pays. business_name is the app's name. Its rooms
 * are named "<room_prefix>-…", which is how webhooks and usage find it.
 */
class NaitalkCallTenant extends Model
{
    public const STATUSES = ['active', 'suspended', 'cancelled'];

    protected $fillable = [
        'client_id',
        'business_name',
        'contact_email',
        'plan',
        'monthly_price_usd_cents',
        'status',
        'room_prefix',
        'key_source',
        'api_key',
        'api_secret',
        'webhook_url',
        'notes',
        'revoked_at',
    ];

    protected $hidden = ['api_secret'];

    protected function casts(): array
    {
        return [
            'api_secret' => 'encrypted',
            'monthly_price_usd_cents' => 'integer',
            'revoked_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function usageEvents(): HasMany
    {
        return $this->hasMany(NaitalkCallUsageEvent::class, 'tenant_id');
    }

    /**
     * New key pair. Letters and digits only, so it can go into livekit.yaml
     * unquoted. Returns the secret; it is shown to the admin once.
     */
    public function issueKey(): string
    {
        $secret = Str::random(48);

        $this->forceFill([
            'key_source' => 'managed',
            'api_key' => 'nc'.Str::lower(Str::random(14)),
            'api_secret' => $secret,
            'revoked_at' => null,
        ])->save();

        return $secret;
    }

    /** Its key is in livekit.yaml: active, not revoked, and managed by Naitalk. */
    public function keyIsLive(): bool
    {
        return $this->status === 'active' && $this->revoked_at === null && $this->key_source === 'managed' && $this->api_key && $this->api_secret;
    }

    /** The tenant whose prefix is the longest match for this room, if any. */
    public static function forRoom(string $roomName): ?self
    {
        return static::query()->get()
            ->filter(fn (self $tenant) => str_starts_with($roomName, $tenant->room_prefix.'-'))
            ->sortByDesc(fn (self $tenant) => strlen($tenant->room_prefix))
            ->first();
    }
}
