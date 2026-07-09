<?php

use App\Http\Controllers\Api\Admin\ClientLifecycleController;
use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\HostingPlanController;
use App\Http\Controllers\Api\Admin\HostingServiceLifecycleController;
use App\Http\Controllers\Api\Admin\InvoicePaymentController as AdminInvoicePaymentController;
use App\Http\Controllers\Api\Admin\IspConfigLegacyImportController;
use App\Http\Controllers\Api\Admin\ProvisioningController;
use App\Http\Controllers\Api\Admin\RecordsController;
use App\Http\Controllers\Api\Admin\ServiceOfferingController as AdminServiceOfferingController;
use App\Http\Controllers\Api\Admin\ServicesDashboardController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Client\CheckoutController;
use App\Http\Controllers\Api\Client\DashboardController as ClientDashboardController;
use App\Http\Controllers\Api\Client\Hosting\DatabaseController;
use App\Http\Controllers\Api\Client\Hosting\FtpAccountController;
use App\Http\Controllers\Api\Client\Hosting\HostingControlPanelController;
use App\Http\Controllers\Api\Client\Hosting\MailboxController;
use App\Http\Controllers\Api\Client\InvoiceController;
use App\Http\Controllers\Api\Client\InvoicePaymentController;
use App\Http\Controllers\Api\Client\OrderController;
use App\Http\Controllers\Api\Client\ServiceCatalogController;
use App\Http\Controllers\Api\Client\ServicesController;
use App\Http\Controllers\Api\Public\CatalogController;
use App\Http\Controllers\Api\Public\PaymentGatewayController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

    Route::get('/public/hosting-plans', [CatalogController::class, 'hostingPlans']);
    Route::get('/public/hosting-add-ons', [CatalogController::class, 'addOns']);

    Route::get('/payments/paystack/callback', [PaymentGatewayController::class, 'paystackCallback']);
    Route::post('/payments/paystack/webhook', [PaymentGatewayController::class, 'paystackWebhook']);
    Route::get('/payments/flutterwave/callback', [PaymentGatewayController::class, 'flutterwaveCallback']);
    Route::post('/payments/flutterwave/webhook', [PaymentGatewayController::class, 'flutterwaveWebhook']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:verification-resend');
        Route::post('/auth/email/verify-code', [AuthController::class, 'verifyCode'])->middleware('throttle:verification-code');

        Route::middleware('role:client')->prefix('client')->group(function (): void {
            Route::get('/dashboard', ClientDashboardController::class);
            Route::get('/services/catalog', ServiceCatalogController::class);
            Route::get('/orders', [OrderController::class, 'index']);
            Route::get('/orders/{order:order_number}/invoice', [InvoiceController::class, 'show']);
            Route::get('/orders/{order:order_number}/invoice/download', [InvoiceController::class, 'downloadPdf']);
            Route::get('/services', [ServicesController::class, 'index']);

            Route::middleware('verified')->group(function (): void {
                Route::post('/orders/hosting', [CheckoutController::class, 'store']);
                Route::post('/invoices/{invoice:invoice_number}/pay/paystack', [InvoicePaymentController::class, 'paystack']);
                Route::post('/invoices/{invoice:invoice_number}/pay/flutterwave', [InvoicePaymentController::class, 'flutterwave']);
                Route::post('/invoices/{invoice:invoice_number}/pay/bank-transfer', [InvoicePaymentController::class, 'bankTransfer']);
                Route::post('/invoices/{invoice:invoice_number}/pay/bank-transfer/proof', [InvoicePaymentController::class, 'uploadBankTransferProof'])->middleware('throttle:hosting-resource-create');

                Route::prefix('services/{service}')->group(function (): void {
                    Route::get('/manage', [HostingControlPanelController::class, 'show']);
                    Route::post('/manage/refresh', [HostingControlPanelController::class, 'refresh'])->middleware('throttle:hosting-manual-sync');
                    Route::post('/manage/auto-renew', [HostingControlPanelController::class, 'updateAutoRenew']);

                    Route::get('/mailboxes', [MailboxController::class, 'index']);
                    Route::post('/mailboxes', [MailboxController::class, 'store'])->middleware('throttle:hosting-resource-create');
                    Route::put('/mailboxes/{mailbox}', [MailboxController::class, 'update']);
                    Route::post('/mailboxes/{mailbox}/change-password', [MailboxController::class, 'changePassword'])->middleware('throttle:hosting-password-reset');
                    Route::post('/mailboxes/{mailbox}/suspend', [MailboxController::class, 'suspend']);
                    Route::post('/mailboxes/{mailbox}/resume', [MailboxController::class, 'resume']);
                    Route::delete('/mailboxes/{mailbox}', [MailboxController::class, 'destroy']);

                    Route::get('/databases', [DatabaseController::class, 'index']);
                    Route::post('/databases', [DatabaseController::class, 'store'])->middleware('throttle:hosting-resource-create');
                    Route::post('/databases/{database}/reset-password', [DatabaseController::class, 'resetPassword'])->middleware('throttle:hosting-password-reset');
                    Route::delete('/databases/{database}', [DatabaseController::class, 'destroy']);

                    Route::get('/ftp-accounts', [FtpAccountController::class, 'index']);
                    Route::post('/ftp-accounts', [FtpAccountController::class, 'store'])->middleware('throttle:hosting-resource-create');
                    Route::post('/ftp-accounts/{ftpAccount}/reset-password', [FtpAccountController::class, 'resetPassword'])->middleware('throttle:hosting-password-reset');
                    Route::post('/ftp-accounts/{ftpAccount}/disable', [FtpAccountController::class, 'disable']);
                    Route::delete('/ftp-accounts/{ftpAccount}', [FtpAccountController::class, 'destroy']);
                });
            });
        });

        Route::middleware('role:super_admin,admin_staff')->prefix('admin')->group(function (): void {
            Route::get('/dashboard', AdminDashboardController::class);
            Route::get('/clients', [RecordsController::class, 'clients']);
            Route::get('/clients/{client}', [RecordsController::class, 'clientDetail']);
            Route::get('/products', [RecordsController::class, 'products']);
            Route::get('/pricing-packages', [HostingPlanController::class, 'index']);
            Route::post('/pricing-packages', [HostingPlanController::class, 'store']);
            Route::put('/pricing-packages/{hostingPlan}', [HostingPlanController::class, 'update']);
            Route::delete('/pricing-packages/{hostingPlan}', [HostingPlanController::class, 'destroy']);
            Route::get('/service-offerings', [AdminServiceOfferingController::class, 'index']);
            Route::post('/service-offerings', [AdminServiceOfferingController::class, 'store']);
            Route::put('/service-offerings/{serviceOffering}', [AdminServiceOfferingController::class, 'update']);
            Route::delete('/service-offerings/{serviceOffering}', [AdminServiceOfferingController::class, 'destroy']);
            Route::get('/orders', [RecordsController::class, 'orders']);
            Route::get('/services', [RecordsController::class, 'services']);
            Route::get('/services/grouped', [ServicesDashboardController::class, 'grouped']);
            Route::get('/services/{service}', [RecordsController::class, 'serviceDetail']);
            Route::get('/invoices', [RecordsController::class, 'invoices']);
            Route::post('/invoices/{invoice:invoice_number}/mark-paid', [AdminInvoicePaymentController::class, 'markPaid']);
            Route::post('/invoices/{invoice:invoice_number}/reject-bank-transfer', [AdminInvoicePaymentController::class, 'rejectBankTransfer']);
            Route::get('/payments/{payment}/receipt', [AdminInvoicePaymentController::class, 'downloadReceipt']);
            Route::get('/payments', [RecordsController::class, 'payments']);
            Route::get('/support-tickets', [RecordsController::class, 'tickets']);
            Route::get('/provisioning-logs', [RecordsController::class, 'provisioningLogs']);
            Route::get('/ispconfig-client-mappings', [RecordsController::class, 'ispConfigClientMappings']);
            Route::get('/audit-logs', [RecordsController::class, 'auditLogs']);
            Route::post('/clients/{client}/convert-to-billing-client', [ClientLifecycleController::class, 'convertToBillingClient']);
            Route::post('/clients/{client}/sync-technical-record', [ClientLifecycleController::class, 'syncClient']);
            Route::post('/clients/{client}/impersonate', [ClientLifecycleController::class, 'impersonate']);
            Route::post('/clients/{client}/suspend', [ClientLifecycleController::class, 'suspend']);
            Route::post('/clients/{client}/deactivate', [ClientLifecycleController::class, 'deactivate']);
            Route::delete('/clients/{client}', [ClientLifecycleController::class, 'softDelete']);
            Route::post('/clients/{client}/restore', [ClientLifecycleController::class, 'restore']);
            Route::post('/ispconfig/import-legacy-client', [ClientLifecycleController::class, 'importLegacyClient']);
            Route::post('/ispconfig/legacy-import/preview', [IspConfigLegacyImportController::class, 'preview']);
            Route::post('/ispconfig/legacy-import/run', [IspConfigLegacyImportController::class, 'run']);
            Route::post('/legacy-services/{service}/override-renewal-date', [IspConfigLegacyImportController::class, 'overrideRenewalDate']);
            Route::post('/legacy-services/{service}/migrate', [IspConfigLegacyImportController::class, 'migrateToPackage']);
            Route::post('/legacy-services/{service}/notify-upgrade', [IspConfigLegacyImportController::class, 'notifyUpgrade']);
            Route::post('/legacy-services/{service}/generate-invoice', [IspConfigLegacyImportController::class, 'generateInvoice']);
            Route::post('/services/{service}/approve-provisioning', [ClientLifecycleController::class, 'approveProvisioning']);
            Route::post('/services/{service}/retry-provisioning', [ClientLifecycleController::class, 'retryProvisioning']);
            Route::post('/services/{service}/suspend', [HostingServiceLifecycleController::class, 'suspendService']);
            Route::post('/services/{service}/deactivate-website', [HostingServiceLifecycleController::class, 'deactivateWebsite']);
            Route::post('/services/{service}/reactivate-website', [HostingServiceLifecycleController::class, 'reactivateWebsite']);
            Route::delete('/services/{service}', [HostingServiceLifecycleController::class, 'deleteService']);
            Route::post('/services/{service}/schedule-deletion', [HostingServiceLifecycleController::class, 'scheduleAutoDeletion']);
            Route::post('/services/{service}/override-grace-period', [HostingServiceLifecycleController::class, 'overrideGracePeriod']);

            Route::get('/ispconfig/health', [ProvisioningController::class, 'health']);
            Route::post('/services/{service}/sync', [ProvisioningController::class, 'syncOne']);
            Route::post('/ispconfig/sync-all', [ProvisioningController::class, 'syncAll']);
            Route::get('/hosting-usage-snapshots', [ProvisioningController::class, 'usageSnapshots']);
            Route::get('/mailbox-records', [ProvisioningController::class, 'mailboxRecords']);
            Route::get('/database-records', [ProvisioningController::class, 'databaseRecords']);
            Route::get('/ftp-account-records', [ProvisioningController::class, 'ftpAccountRecords']);
        });
    });
});
