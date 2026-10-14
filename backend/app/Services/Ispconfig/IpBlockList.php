<?php

namespace App\Services\Ispconfig;

use App\Models\AppSetting;
use App\Models\HostingService;
use Illuminate\Validation\ValidationException;

/**
 * IP addresses blocked from websites — one list per website (client or admin
 * managed) plus one admin list applied to every website.
 *
 * Entries are single addresses or ranges in CIDR form. Ranges wider than a
 * /16 (IPv4) or /32 (IPv6), and private/loopback addresses, are refused:
 * they would lock out whole networks or the server itself.
 */
class IpBlockList
{
    public const GLOBAL_SETTING_KEY = 'global_blocked_ips';

    public const MAX_PER_SITE = 200;

    /**
     * Normalises "203.0.113.5", "203.0.113.0/24" or an IPv6 equivalent, or
     * throws a validation error worded for the person typing it.
     */
    public static function normalize(string $input, string $field = 'ip'): string
    {
        $value = trim($input);
        [$address, $prefix] = array_pad(explode('/', $value, 2), 2, null);

        $isV4 = filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;
        $isV6 = ! $isV4 && filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false;

        if (! $isV4 && ! $isV6) {
            throw ValidationException::withMessages([$field => ['Enter an IP address like 203.0.113.5, or a range like 203.0.113.0/24.']]);
        }

        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            throw ValidationException::withMessages([$field => ['That is a private or reserved address — blocking it could cut off the server itself.']]);
        }

        $address = inet_ntop(inet_pton($address));

        if ($prefix === null) {
            return $address;
        }

        $max = $isV4 ? 32 : 128;
        $min = $isV4 ? 16 : 32;

        if (! ctype_digit($prefix) || (int) $prefix > $max) {
            throw ValidationException::withMessages([$field => ['That range is not valid.']]);
        }

        if ((int) $prefix < $min) {
            throw ValidationException::withMessages([$field => ["That range is too wide — the widest you can block is /{$min}."]]);
        }

        return (int) $prefix === $max ? $address : "{$address}/{$prefix}";
    }

    /** @return array<int, array{ip: string, note: ?string, added_at: string, added_by: string}> */
    public static function global(): array
    {
        return array_values((array) AppSetting::get(self::GLOBAL_SETTING_KEY, []));
    }

    /** @param  array<int, array<string, mixed>>  $entries */
    public static function saveGlobal(array $entries): void
    {
        AppSetting::put(self::GLOBAL_SETTING_KEY, array_values($entries));
    }

    /** What actually gets blocked on a website: its own list plus the all-websites list. */
    public static function effectiveFor(HostingService $service): array
    {
        return collect($service->blocked_ips ?? [])
            ->merge(self::global())
            ->pluck('ip')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /** @param  array<int, array<string, mixed>>  $entries */
    public static function withEntry(array $entries, string $ip, ?string $note, string $addedBy): array
    {
        if (collect($entries)->contains('ip', $ip)) {
            throw ValidationException::withMessages(['ip' => ["{$ip} is already blocked."]]);
        }

        if (count($entries) >= self::MAX_PER_SITE) {
            throw ValidationException::withMessages(['ip' => ['You can block up to '.self::MAX_PER_SITE.' addresses. Remove some old ones first.']]);
        }

        $entries[] = ['ip' => $ip, 'note' => $note ? mb_substr(trim($note), 0, 120) : null, 'added_at' => now()->toIso8601String(), 'added_by' => $addedBy];

        return array_values($entries);
    }

    /** @param  array<int, array<string, mixed>>  $entries */
    public static function withoutEntry(array $entries, string $ip): array
    {
        return collect($entries)->reject(fn (array $entry) => ($entry['ip'] ?? null) === $ip)->values()->all();
    }
}
