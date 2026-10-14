<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:160', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'phone' => ['nullable', 'string', 'max:60'],
            'company_name' => ['nullable', 'string', 'max:160'],
            'billing_address' => ['nullable', 'string', 'max:1000'],
            'terms_accepted' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return ['terms_accepted.accepted' => 'Please agree to the Terms of Service to create your account.'];
    }
}
