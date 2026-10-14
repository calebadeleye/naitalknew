<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class TermsAcceptance extends Model
{
    protected $fillable = [
        'user_id',
        'client_id',
        'version',
        'context',
        'reference',
        'ip_address',
        'user_agent',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }

    /** Records that the person behind $request ticked "I agree" just now. */
    public static function record(Request $request, ?User $user, ?Client $client, string $context, ?string $reference = null): self
    {
        return self::query()->create([
            'user_id' => $user?->id,
            'client_id' => $client?->id,
            'version' => (string) config('legal.terms_version'),
            'context' => $context,
            'reference' => $reference,
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            'accepted_at' => now(),
        ]);
    }
}
