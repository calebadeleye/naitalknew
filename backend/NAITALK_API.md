# NAI TALK Laravel Backend API

Laravel is the billing and hosting source of truth. React should consume these JSON endpoints rather than keeping dashboard data locally.

## Local Setup

```bash
cd backend
php artisan config:clear
php artisan migrate:fresh --seed
php artisan serve --port=8000
```

The backend expects MySQL by default:

```dotenv
DB_CONNECTION=mysql
DB_DATABASE=naitalk_backend
```

Demo credentials:

- Admin: `admin@naitalk.com` / `password`
- Client: `john@naitalk.test` / `password`

## Auth Flow

Public registration creates a Laravel user and client profile only. It does not create an order, invoice, ISPConfig client, or hosting resource.

```http
POST /api/v1/auth/register
{
  "name": "Prospect User",
  "email": "prospect@example.com",
  "password": "secret-password",
  "phone": "08000000000"
}
```

```http
POST /api/v1/auth/login
{
  "email": "admin@naitalk.com",
  "password": "password",
  "device_name": "react-dashboard"
}
```

Use the returned token as:

```http
Authorization: Bearer <token>
```

## Public Website Endpoints

- `GET /api/v1/public/hosting-plans`
- `GET /api/v1/public/hosting-add-ons`
- `POST /api/v1/checkout/hosting`
- `POST /api/v1/payments/verify`

The checkout endpoint creates or reuses the Laravel client account, writes the order, invoice, and hosting service, then leaves the hosting service in `pending_payment` / `not_provisioned`.

The payment verification endpoint must be called after Paystack or Flutterwave has been verified server-side. It marks the invoice paid, moves hosting into `awaiting_provisioning`, and provisions/reuses the ISPConfig client mapping.

## Client Portal Endpoints

- `GET /api/v1/client/dashboard`
- `GET /api/v1/client/services` — unified "Active Services" list (hosting + any other purchased service offering). Only hosting entries carry a `manage_url`.

Requires a client token.

### Mini Hosting Control Panel

Only reachable by opening a specific hosting service from the services list above — never shown automatically.

- `GET /api/v1/client/services/{service}/manage` — overview, cached usage summary, capabilities (all served from local tables, never a live ISPConfig call)
- `POST /api/v1/client/services/{service}/manage/refresh` — queues a scoped resync for this one service (rate limited)
- `GET|POST|PUT|DELETE /api/v1/client/services/{service}/mailboxes[/{mailbox}][/change-password]`
- `GET|POST|DELETE /api/v1/client/services/{service}/databases[/{database}][/reset-password]`
- `GET|POST|DELETE /api/v1/client/services/{service}/ftp-accounts[/{ftpAccount}][/reset-password|/disable]`

All of the above are policy-gated (ownership + plan resource limits) and rate-limited (`hosting-resource-create`, `hosting-password-reset`, `hosting-manual-sync`). Every mutation is dispatched as a queued job that calls ISPConfig and then updates the local record — the HTTP response returns `202` with the record in a `provisioning` state, not a synchronous result. Destructive actions (mailbox/database/FTP deletion) require `"confirm": true` in the request body or return `422`. No password is ever persisted — creation/reset endpoints send the password straight to ISPConfig and never store it.

## Admin Dashboard Endpoints

- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/clients`
- `GET /api/v1/admin/products`
- `GET /api/v1/admin/orders`
- `GET /api/v1/admin/services`
- `GET /api/v1/admin/invoices`
- `GET /api/v1/admin/payments`
- `GET /api/v1/admin/support-tickets`
- `GET /api/v1/admin/provisioning-logs`
- `GET /api/v1/admin/ispconfig-client-mappings`
- `GET /api/v1/admin/audit-logs`
- `POST /api/v1/admin/clients/{client}/convert-to-billing-client`
- `POST /api/v1/admin/clients/{client}/sync-technical-record`
- `POST /api/v1/admin/ispconfig/import-legacy-client`
- `POST /api/v1/admin/services/{service}/approve-provisioning`
- `POST /api/v1/admin/services/{service}/retry-provisioning`
- `GET /api/v1/admin/ispconfig/health` — SOAP login/logout round-trip against the configured ISPConfig server
- `POST /api/v1/admin/services/{service}/sync` / `POST /api/v1/admin/ispconfig/sync-all`
- `GET /api/v1/admin/hosting-usage-snapshots`, `/mailbox-records`, `/database-records`, `/ftp-account-records`

Requires a `super_admin` or `admin_staff` token.

The admin Clients page must read from Laravel `/admin/clients`, not ISPConfig. Supported filters include `account_type`, `client_status`, `has_hosting_service`, `ispconfig_provisioned`, `hosting_status`, and `outstanding_invoice`.

## ISPConfig Boundary

Laravel is the customer, account, billing, invoice, payment, support, renewal, and admin list source of truth. ISPConfig is only used for technical hosting resources after verified hosting payment or explicit admin provisioning approval.

Mappings live in:

- `ispconfig_client_mappings`
- `ispconfig_service_mappings`

Local read-model/cache tables (never bypassed with a live ISPConfig call for normal dashboard reads):

- `hosting_usage_snapshots` — append-only disk/bandwidth/resource-count history per hosting service
- `mailbox_records`, `database_records`, `ftp_account_records` — one row per actual technical resource

## Provisioning Architecture

Package technical limits live in `hosting_plans.configuration_json` (disk/bandwidth quotas, max email/database/FTP counts, SSH/SFTP/SSL/backup flags, PHP version) — read via `HostingPlan::configuration()`. The provisioning layer never hardcodes these.

When an invoice is marked paid, `PaymentFulfillmentService` moves each hosting service to `awaiting_provisioning` and calls `IspConfigProvisioningService::queueProvisioning()`, which logs the intent and dispatches `App\Jobs\ProvisionHostingServiceJob` — **provisioning is always queued, never run inline inside the payment webhook/callback request.** The job is idempotent (`ShouldBeUnique`, reuses an existing ISPConfig client/website by id before creating a new one) and retries with backoff; if all retries are exhausted it marks `provisioning_status = 'provisioning_failed'` and emails every `super_admin`/`admin_staff` user via `HostingProvisioningFailed`. Admins can re-trigger it with `POST /admin/services/{service}/retry-provisioning`.

All real ISPConfig SOAP calls go through the `App\Services\Ispconfig\IspConfigClient` interface (`SoapIspConfigClient` in production, `FakeIspConfigClient` bound only in the `testing` environment) — connection details are configured via `ISPCONFIG_*` env vars / `config/ispconfig.php`, never hardcoded. Run `php artisan ispconfig:health-check` to verify the configured connection.

Scheduled sync jobs (registered in `routes/console.php`) keep the local read-model aligned with ISPConfig: `SyncHostingUsageSnapshotJob` (hourly), `SyncIspConfigHostingServicesJob`/`SyncMailboxesJob`/`SyncDatabasesJob`/`SyncFtpAccountsJob` (every 6h), `SyncIspConfigClientMappingsJob` (twice daily), `DetectOrphanedIspConfigClientsJob`/`DetectMissingIspConfigResourcesJob` (daily, full reconciliation). They only ever update technical status/sync fields and the cache tables — they flag discrepancies via `ProvisioningLog` for admin review and never overwrite billing data.
