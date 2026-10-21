<x-mail::message>
@php
    $naitalkNoticeTitles = [
        'ClientAccountDeactivated' => 'Account Deactivation Notice',
        'ClientAccountRestored' => 'Account Restored',
        'ClientAccountSuspended' => 'Account Suspension Notice',
        'ClientNotificationFailed' => 'Notification Delivery Failed',
        'EmailOnlySetupInstructions' => 'Business Email Setup',
        'HostingDeletedFromIspConfig' => 'Website Removed Notice',
        'HostingExpiredNotice' => 'Hosting Expiry Notice',
        'HostingFinalDeletionWarning' => 'Final Deletion Warning',
        'HostingProvisioningFailed' => 'Provisioning Issue',
        'HostingRenewalReminder' => 'Hosting Renewal Reminder',
        'HostingSuspendedGracePeriodEnded' => 'Hosting Suspended',
        'IspConfigActionFailed' => 'Action Failed Notice',
        'NaiTalkHostingProvisioned' => 'Hosting Provisioned',
        'NaiTalkInvoiceCreated' => 'Invoice Notification',
        'NaiTalkPaymentProofUploaded' => 'Payment Proof Received',
        'NaiTalkVerificationCode' => 'Verification Code',
        'NaiTalkPasswordReset' => 'Password Reset',
        'GreenmailCode' => 'Your Green Mail Code',
        'GreenmailResetRequestedForOwner' => 'Password Reset Request',
        'ServiceAnnouncement' => 'Scheduled Maintenance',
        'WebsiteHostingDeactivated' => 'Website Deactivated',
        'WebsiteHostingReactivated' => 'Website Reactivated',
    ];
    $naitalkNotificationClass = isset($__laravel_notification) ? class_basename($__laravel_notification) : null;
    $naitalkNoticeTitle = $noticeTitle ?? $naitalkNoticeTitles[$naitalkNotificationClass]
        ?? ($naitalkNotificationClass ? \Illuminate\Support\Str::title(\Illuminate\Support\Str::snake($naitalkNotificationClass, ' ')) : 'Service Update');
@endphp
{{-- Hero: the greeting, then the brand line --}}
<x-mail::hero :eyebrow="! empty($greeting) ? $greeting : ($level === 'error' ? __('Whoops!') : __('Hello,'))" />

<table class="section" width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="pad section-cell">

<h2 class="section-title">{{ $naitalkNoticeTitle }}</h2>

{{-- Intro Lines --}}
@foreach ($introLines as $line)
{{ $line }}

@endforeach

{{-- Action Button --}}
@isset($actionText)
<?php
    $color = match ($level) {
        'success', 'error' => $level,
        default => 'primary',
    };
?>
<x-mail::button :url="$actionUrl" :color="$color">
{{ $actionText }}
</x-mail::button>
@endisset

{{-- Outro Lines --}}
@foreach ($outroLines as $line)
{{ $line }}

@endforeach

{{-- Salutation --}}
@if (! empty($salutation))
{{ $salutation }}
@else
@lang('Regards,')<br>
The NAI TALK Team
@endif

</td>
</tr>
</table>

{{-- Subcopy --}}
@isset($actionText)
<x-slot:subcopy>
@lang(
    "If you're having trouble clicking the \":actionText\" button, copy and paste the URL below\n".
    'into your web browser:',
    [
        'actionText' => $actionText,
    ]
) <span class="break-all">[{{ $displayableActionUrl }}]({{ $actionUrl }})</span>
</x-slot:subcopy>
@endisset
</x-mail::message>
