<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A business that uses Naitalk Call. Its rooms are named "<room_prefix>-…",
 * which is how webhooks and usage are matched back to it.
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
    ];

    protected $hidden = ['api_secret'];

    protected function casts(): array
    {
        return [
            'api_secret' => 'encrypted',
            'monthly_price_usd_cents' => 'integer',
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
        ])->save();

        return $secret;
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
