<?php

namespace App\Rules;

use App\Services\Turnstile;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class PassesTurnstile implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! Turnstile::verify(is_string($value) ? $value : null, request()->ip())) {
            $fail('The security check didn’t pass. Please try again.');
        }
    }
}
