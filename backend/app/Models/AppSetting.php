<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Small key/value store for switches an admin flips from the dashboard
 * (as opposed to .env, which needs a deploy).
 */
class AppSetting extends Model
{
    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'json'];
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $row = static::query()->where('key', $key)->first();

        return $row ? $row->value : $default;
    }

    public static function put(string $key, mixed $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
