<?php

namespace App\Http\Controllers\Api\Admin\Concerns;

use App\Models\AuditLog;
use App\Models\Client;
use App\Models\HostingService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Shared "required reason form" validation + audit logging for every
 * sensitive admin action (suspend, deactivate, soft-delete, deactivate
 * website, security deactivation, override grace period...). Every action
 * that touches this trait ends up in the same audit_logs table with the
 * same shape, so reporting/dispute-resolution never has to reconcile
 * differently-shaped logs.
 */
trait RequiresReasonForm
{
    protected const REASON_CATEGORIES = [
        'hosting_expired',
        'non_payment',
        'abuse_report',
        'security_threat',
        'suspicious_activity',
        'client_request',
        'terms_violation',
        'administrative_correction',
        'other',
    ];

    /**
     * @return array{reason_category: string, reason_note: string, notify_client: bool, effective_at: ?string, supporting_reference: ?string}
     */
    protected function validateReasonForm(Request $request): array
    {
        $payload = $request->validate([
            'reason_category' => ['required', 'string', Rule::in(self::REASON_CATEGORIES)],
            'reason_note' => ['required', 'string', 'max:2000'],
            'notify_client' => ['nullable', 'boolean'],
            'effective_at' => ['nullable', 'date'],
            'supporting_reference' => ['nullable', 'string', 'max:255'],
        ]);

        return [
            'reason_category' => $payload['reason_category'],
            'reason_note' => $payload['reason_note'],
            'notify_client' => (bool) ($payload['notify_client'] ?? true),
            'effective_at' => $payload['effective_at'] ?? null,
            'supporting_reference' => $payload['supporting_reference'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     * @param  array{reason_category: string, reason_note: string, notify_client: bool, effective_at: ?string, supporting_reference: ?string}  $reasonForm
     * @param  array<string, mixed>|null  $ispconfigResponse
     */
    protected function auditAction(
        Request $request,
        string $action,
        ?Client $client,
        ?HostingService $service,
        ?array $before,
        ?array $after,
        array $reasonForm,
        string $source = 'admin',
        ?array $ispconfigResponse = null,
        ?string $errorDetails = null,
    ): AuditLog {
        return AuditLog::query()->create([
            'staff_user_id' => $request->user()?->id,
            'client_id' => $client?->id,
            'hosting_service_id' => $service?->id,
            'action' => $action,
            'reason' => $reasonForm['reason_note'],
            'reason_category' => $reasonForm['reason_category'],
            'notify_client' => $reasonForm['notify_client'],
            'effective_at' => $reasonForm['effective_at'] ?? now(),
            'supporting_reference' => $reasonForm['supporting_reference'],
            'source' => $source,
            'before_state' => $before,
            'after_state' => $after,
            'ispconfig_response' => $ispconfigResponse,
            'error_details' => $errorDetails,
        ]);
    }
}
