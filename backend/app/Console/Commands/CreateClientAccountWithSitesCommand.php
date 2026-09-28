<?php

namespace App\Console\Commands;

use App\Jobs\SyncHostingUsageSnapshotJob;
use App\Services\Ispconfig\ClientAccountWithSitesCreator;
use Illuminate\Console\Command;
use Throwable;

/**
 * Admin tool: give the owner of websites that already live in ISPConfig
 * their own NAI TALK login and hosting services. Refuses if the email
 * already has a login or a site is already attached to a service.
 */
class CreateClientAccountWithSitesCommand extends Command
{
    protected $signature = 'clients:create-with-sites
        {email : Login email for the new account}
        {--password= : Initial password}
        {--name= : Account holder name}
        {--company= : Company / organisation name}
        {--ispconfig-client= : ISPConfig client id that owns the websites}
        {--domain=* : Exact ISPConfig website domain (repeatable)}
        {--package=starter-website-care : Website Care package slug}';

    protected $description = 'Create a client login and attach existing ISPConfig websites to it as hosting services';

    public function handle(ClientAccountWithSitesCreator $creator): int
    {
        foreach (['password', 'name', 'ispconfig-client'] as $required) {
            if (! $this->option($required)) {
                $this->error("--{$required} is required.");

                return self::FAILURE;
            }
        }

        if (! $this->option('domain')) {
            $this->error('At least one --domain is required.');

            return self::FAILURE;
        }

        try {
            $result = $creator->create(
                (string) $this->argument('email'),
                (string) $this->option('password'),
                (string) $this->option('name'),
                $this->option('company') ?: null,
                (int) $this->option('ispconfig-client'),
                $this->option('domain'),
                (string) $this->option('package'),
            );
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Created login {$result['user']->email} (client {$result['client']->client_code}).");
        $this->table(['Domain', 'Result', 'Renews', 'Detail'], array_map(fn ($row) => [
            $row['service']->primary_domain,
            $row['result']['status'],
            $row['service']->renews_at?->toDateString() ?? '—',
            $row['result']['status'] === 'migrated'
                ? 'quota '.($row['result']['quota']['previous_quota_mb'] === -1 ? 'unlimited' : $row['result']['quota']['previous_quota_mb'].' MB').' → '.$row['result']['quota']['new_quota_mb'].' MB'
                : $row['result']['message'],
        ], $result['services']));

        SyncHostingUsageSnapshotJob::dispatchSync(null, 'account_created');

        return self::SUCCESS;
    }
}
