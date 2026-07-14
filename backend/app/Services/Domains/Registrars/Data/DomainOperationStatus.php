<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * Maps 1:1 to domains.registrar_operation_status. Deliberately independent
 * of payment/invoice state — a paid invoice does not mean the registrar has
 * finished the operation; only a registrar-confirmed result (or an observed
 * expiry-date change) advances this to Completed.
 */
enum DomainOperationStatus: string
{
    case NotStarted = 'not_started';
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';
    case RequiresAttention = 'requires_attention';
}
