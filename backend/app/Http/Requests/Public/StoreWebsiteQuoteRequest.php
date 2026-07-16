<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreWebsiteQuoteRequest extends FormRequest
{
    public const WEBSITE_TYPES = [
        'Business or Corporate Website',
        'E-commerce Website',
        'School Website',
        'Church or Ministry Website',
        'Personal or Portfolio Website',
        'Blog or News Website',
        'Hotel or Hospitality Website',
        'Healthcare Website',
        'NGO or Organisation Website',
        'Website Redesign',
        'Other',
    ];

    public const BUDGET_RANGES = [
        '₦100,000 – ₦200,000',
        '₦200,000 – ₦400,000',
        '₦400,000 – ₦750,000',
        'Above ₦750,000',
        'Not Sure Yet',
    ];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_map(
            static fn ($value) => is_string($value) ? trim($value) : $value,
            $this->all()
        ));
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'phone' => ['required', 'string', 'max:30'],
            'email' => ['required', 'email', 'max:160'],
            // Rule::in (not the "in:a,b,c" string form) because the budget
            // ranges themselves contain commas (e.g. "₦100,000"), which the
            // string form would otherwise split on.
            'website_type' => ['required', 'string', Rule::in(self::WEBSITE_TYPES)],
            'estimated_budget' => ['required', 'string', Rule::in(self::BUDGET_RANGES)],
            'project_description' => ['required', 'string', 'min:20', 'max:2000'],
            'landing_page' => ['nullable', 'string', 'max:500'],
            'utm_source' => ['nullable', 'string', 'max:160'],
            'utm_medium' => ['nullable', 'string', 'max:160'],
            'utm_campaign' => ['nullable', 'string', 'max:160'],
            'utm_term' => ['nullable', 'string', 'max:160'],
            'utm_content' => ['nullable', 'string', 'max:160'],
            'gclid' => ['nullable', 'string', 'max:255'],
            'referrer' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.email' => 'Please enter a valid email address.',
            'website_type.in' => 'Please select a valid website type.',
            'estimated_budget.in' => 'Please select a valid budget range.',
        ];
    }
}
