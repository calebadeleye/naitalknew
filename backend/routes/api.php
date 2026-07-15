<?php

use App\Http\Controllers\Api\Admin\BlogPostController;
use App\Http\Controllers\Api\Admin\ClientLifecycleController;
use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\DomainAssignmentController;
use App\Http\Controllers\Api\Admin\DomainController as AdminDomainController;
use App\Http\Controllers\Api\Admin\DomainPricingController;
use App\Http\Controllers\Api\Admin\DomainPricingSettingsController;
use App\Http\Controllers\Api\Admin\FaqController;
use App\Http\Controllers\Api\Admin\HostingPlanController;
use App\Http\Controllers\Api\Admin\HostingServiceLifecycleController;
use App\Http\Controllers\Api\Admin\InvoiceController as AdminInvoiceController;
use App\Http\Controllers\Api\Admin\InvoicePaymentController as AdminInvoicePaymentController;
use App\Http\Controllers\Api\Admin\IspConfigLegacyImportController;
use App\Http\Controllers\Api\Admin\KnowledgeBaseController;
use App\Http\Controllers\Api\Admin\PageSeoMetadataController;
use App\Http\Controllers\Api\Admin\ProvisioningController;
use App\Http\Controllers\Api\Admin\RecordsController;
use App\Http\Controllers\Api\Admin\ServiceOfferingController as AdminServiceOfferingController;
use App\Http\Controllers\Api\Admin\ServicesDashboardController;
use App\Http\Controllers\Api\Admin\ServiceStatusController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Client\CheckoutController;
use App\Http\Controllers\Api\Client\ClientProfileController;
use App\Http\Controllers\Api\Client\DashboardController as ClientDashboardController;
use App\Http\Controllers\Api\Client\DomainContactController;
use App\Http\Controllers\Api\Client\DomainController;
use App\Http\Controllers\Api\Client\DomainOrderController;
use App\Http\Controllers\Api\Client\DomainTransferController;
use App\Http\Controllers\Api\Client\Hosting\DatabaseController;
use App\Http\Controllers\Api\Client\Hosting\FtpAccountController;
use App\Http\Controllers\Api\Client\Hosting\HostingControlPanelController;
use App\Http\Controllers\Api\Client\Hosting\MailboxController;
use App\Http\Controllers\Api\Client\InvoiceController;
use App\Http\Controllers\Api\Client\InvoicePaymentController;
use App\Http\Controllers\Api\Client\OrderController;
use App\Http\Controllers\Api\Client\SavedCardPaymentController;
use App\Http\Controllers\Api\Client\SavedPaymentMethodController;
use App\Http\Controllers\Api\Client\ServiceCatalogController;
use App\Http\Controllers\Api\Client\ServicesController;
use App\Http\Controllers\Api\Client\WalletController;
use App\Http\Controllers\Api\Client\WalletFundingController;
use App\Http\Controllers\Api\Client\WalletPaymentController;
use App\Http\Controllers\Api\Public\CatalogController;
use App\Http\Controllers\Api\Public\ContentController;
use App\Http\Controllers\Api\Public\DomainSearchController;
use App\Http\Controllers\Api\Public\PaymentGatewayController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

    Route::get('/public/hosting-plans', [CatalogController::class, 'hostingPlans']);
    Route::get('/public/hosting-add-ons', [CatalogController::class, 'addOns']);
    Route::get('/public/billing-config', [CatalogController::class, 'billingConfig']);
    Route::get('/public/domains/search', [DomainSearchController::class, 'search'])->middleware('throttle:60,1');
    Route::get('/public/domains/pricing', [DomainSearchController::class, 'pricing']);
    Route::get('/public/domains/pricing-table', [DomainSearchController::class, 'pricingTable']);

    Route::get('/public/blog', [ContentController::class, 'blogIndex']);
    Route::get('/public/blog/{slug}', [ContentController::class, 'blogShow']);
    Route::get('/public/knowledge-base', [ContentController::class, 'knowledgeBaseIndex']);
    Route::get('/public/knowledge-base/{slug}', [ContentController::class, 'knowledgeBaseShow']);
    Route::get('/public/faqs', [ContentController::class, 'faqs']);
    Route::get('/public/service-status', [ContentController::class, 'serviceStatus']);
    Route::get('/public/seo-metadata', [ContentController::class, 'seoMetadata']);
    Route::get('/public/images/search', [ContentController::class, 'image'])->middleware('throttle:60,1');

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
            Route::get('/invoices/{invoice:invoice_number}', [InvoiceController::class, 'showByNumber']);
            Route::get('/invoices/{invoice:invoice_number}/download', [InvoiceController::class, 'downloadByNumberPdf']);
            Route::get('/services', [ServicesController::class, 'index']);
            Route::get('/wallet', [WalletController::class, 'show']);
            Route::get('/wallet/transactions', [WalletController::class, 'transactions']);
            Route::get('/payment-methods', [SavedPaymentMethodController::class, 'index']);
            Route::get('/profile', [ClientProfileController::class, 'show']);
            Route::get('/profile/activity', [ClientProfileController::class, 'activity']);
            Route::get('/domains', [DomainController::class, 'index']);
            Route::get('/domains/{domain}', [DomainController::class, 'show']);
            Route::get('/domains/transfers/eligibility', [DomainTransferController::class, 'eligibility']);
            Route::get('/domain-contact', [DomainContactController::class, 'show']);
            Route::put('/domain-contact', [DomainContactController::class, 'update']);

            // Managing your own account (profile fields, security toggles,
            // password) is never gated behind email verification — only
            // actions that move money or provision real infrastructure are.
            Route::put('/profile', [ClientProfileController::class, 'update']);
            Route::put('/profile/communication-preferences', [ClientProfileController::class, 'updateCommunicationPreferences']);
            Route::put('/profile/security', [ClientProfileController::class, 'updateSecurity']);
            Route::post('/profile/change-password', [ClientProfileController::class, 'changePassword'])->middleware('throttle:hosting-password-reset');

            Route::middleware('verified')->group(function (): void {
                Route::post('/orders/hosting', [CheckoutController::class, 'store']);
                Route::post('/invoices/{invoice:invoice_number}/pay/paystack', [InvoicePaymentController::class, 'paystack']);
                Route::post('/invoices/{invoice:invoice_number}/pay/flutterwave', [InvoicePaymentController::class, 'flutterwave']);
                Route::post('/invoices/{invoice:invoice_number}/pay/bank-transfer', [InvoicePaymentController::class, 'bankTransfer']);
                Route::post('/invoices/{invoice:invoice_number}/pay/bank-transfer/proof', [InvoicePaymentController::class, 'uploadBankTransferProof'])->middleware('throttle:hosting-resource-create');
                Route::post('/invoices/{invoice:invoice_number}/pay/wallet', [WalletPaymentController::class, 'pay']);
                Route::post('/invoices/{invoice:invoice_number}/pay/saved-card/{paymentMethod}', [SavedCardPaymentController::class, 'pay']);
                Route::post('/wallet/fund/paystack', [WalletFundingController::class, 'paystack']);
                Route::post('/wallet/fund/flutterwave', [WalletFundingController::class, 'flutterwave']);
                Route::patch('/payment-methods/{paymentMethod}', [SavedPaymentMethodController::class, 'update']);
                Route::delete('/payment-methods/{paymentMethod}', [SavedPaymentMethodController::class, 'destroy']);

                Route::post('/domains/orders', [DomainOrderController::class, 'store']);
                Route::post('/domains/transfers', [DomainTransferController::class, 'store']);
                Route::patch('/domains/{domain}/auto-renew', [DomainController::class, 'updateAutoRenew']);
                Route::post('/domains/{domain}/hosting', [DomainController::class, 'addHosting']);
                Route::post('/domains/{domain}/renew', [DomainController::class, 'renew']);

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
            Route::post('/invoices', [AdminInvoiceController::class, 'store']);
            Route::post('/invoices/{invoice:invoice_number}/mark-paid', [AdminInvoicePaymentController::class, 'markPaid']);
            Route::post('/invoices/{invoice:invoice_number}/reject-bank-transfer', [AdminInvoicePaymentController::class, 'rejectBankTransfer']);
            Route::get('/payments/{payment}/receipt', [AdminInvoicePaymentController::class, 'downloadReceipt']);
            Route::get('/payments', [RecordsController::class, 'payments']);
            Route::get('/support-tickets', [RecordsController::class, 'tickets']);
            Route::get('/provisioning-logs', [RecordsController::class, 'provisioningLogs']);
            Route::get('/ispconfig-client-mappings', [RecordsController::class, 'ispConfigClientMappings']);
            Route::get('/audit-logs', [RecordsController::class, 'auditLogs']);

            Route::get('/blog-posts', [BlogPostController::class, 'index']);
            Route::post('/blog-posts', [BlogPostController::class, 'store']);
            Route::put('/blog-posts/{blogPost}', [BlogPostController::class, 'update']);
            Route::delete('/blog-posts/{blogPost}', [BlogPostController::class, 'destroy']);

            Route::get('/knowledge-base/groups', [KnowledgeBaseController::class, 'groups']);
            Route::post('/knowledge-base/groups', [KnowledgeBaseController::class, 'storeGroup']);
            Route::get('/knowledge-base/articles', [KnowledgeBaseController::class, 'articles']);
            Route::post('/knowledge-base/articles', [KnowledgeBaseController::class, 'storeArticle']);
            Route::put('/knowledge-base/articles/{article}', [KnowledgeBaseController::class, 'updateArticle']);
            Route::delete('/knowledge-base/articles/{article}', [KnowledgeBaseController::class, 'destroyArticle']);

            Route::get('/faqs', [FaqController::class, 'index']);
            Route::post('/faqs', [FaqController::class, 'store']);
            Route::put('/faqs/{faq}', [FaqController::class, 'update']);
            Route::delete('/faqs/{faq}', [FaqController::class, 'destroy']);

            Route::get('/service-statuses', [ServiceStatusController::class, 'index']);
            Route::put('/service-statuses/{serviceStatus}', [ServiceStatusController::class, 'update']);

            Route::get('/seo-metadata', [PageSeoMetadataController::class, 'index']);
            Route::put('/seo-metadata', [PageSeoMetadataController::class, 'upsert']);

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

            Route::get('/domains', [RecordsController::class, 'domains']);
            Route::get('/domain-orders', [RecordsController::class, 'domainOrders']);
            Route::get('/domain-transfers', [RecordsController::class, 'domainTransfers']);
            Route::post('/domain-orders/{domainOrder}/mark-registered', [AdminDomainController::class, 'markRegistered']);
            Route::post('/domain-transfers/{transfer}/retry-sync', [AdminDomainController::class, 'retryTransferSync']);
            Route::post('/domains/{domain}/mark-source', [AdminDomainController::class, 'markSource']);
            Route::post('/domains/{domain}/link-hosting', [AdminDomainController::class, 'linkHosting']);
            Route::post('/domains/{domain}/unlink-hosting', [AdminDomainController::class, 'unlinkHosting']);
            Route::post('/domains/{domain}/send-dns-instructions', [AdminDomainController::class, 'sendDnsInstructions']);
            Route::post('/domains/{domain}/renew', [AdminDomainController::class, 'renew']);
            Route::post('/domains/{domain}/disable-auto-renew', [AdminDomainController::class, 'disableAutoRenew']);
            Route::post('/domains/{domain}/note', [AdminDomainController::class, 'addNote']);
            Route::get('/domains/{domain}/sync-logs', [AdminDomainController::class, 'syncLogs']);

            Route::get('/domain-assignments', [DomainAssignmentController::class, 'index']);
            Route::post('/domain-assignments/{domain}/assign', [DomainAssignmentController::class, 'assign']);
            Route::post('/domain-assignments/{domain}/reassign', [DomainAssignmentController::class, 'reassign']);
            Route::post('/domain-assignments/{domain}/mark-internal', [DomainAssignmentController::class, 'markInternal']);
            Route::post('/domains/{domain}/refresh-from-cloudflare', [DomainAssignmentController::class, 'refreshFromCloudflare']);

            Route::get('/domain-pricing', [DomainPricingController::class, 'index']);
            Route::post('/domain-pricing', [DomainPricingController::class, 'store']);
            Route::post('/domain-pricing/sync', [DomainPricingController::class, 'sync']);
            Route::get('/domain-pricing/sync-logs', [DomainPricingController::class, 'syncLogs']);
            Route::put('/domain-pricing/{domainPricing}', [DomainPricingController::class, 'update']);
            Route::delete('/domain-pricing/{domainPricing}', [DomainPricingController::class, 'destroy']);

            Route::get('/domain-pricing-settings', [DomainPricingSettingsController::class, 'show']);
            Route::put('/domain-pricing-settings', [DomainPricingSettingsController::class, 'update']);
            Route::put('/domain-pricing-settings/balance', [DomainPricingSettingsController::class, 'updateBalance']);
        });
    });
});
