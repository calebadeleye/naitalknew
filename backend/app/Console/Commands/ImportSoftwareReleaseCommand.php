<?php

namespace App\Console\Commands;

use App\Services\SoftwareInstall\SoftwareInstallOrchestrator;
use Illuminate\Console\Command;
use Throwable;

class ImportSoftwareReleaseCommand extends Command
{
    protected $signature = 'software:import-release {slug : Catalog entry the archive is a build of} {archive : Path of the .tgz, readable by the build account} {--keep : Do not delete the archive afterwards}';

    protected $description = 'Publish a release built elsewhere (laptop/CI) as the shared release for a Software catalog app, so installs never have to build on the capped build account.';

    public function handle(SoftwareInstallOrchestrator $orchestrator): int
    {
        $slug = (string) $this->argument('slug');
        $archive = (string) $this->argument('archive');

        if (! is_file($archive) || ! is_readable($archive)) {
            $this->error("Archive not found or not readable: {$archive}");

            return self::FAILURE;
        }

        $this->info("Importing {$archive} as the {$slug} release...");

        try {
            $result = $orchestrator->importRelease($slug, $archive);
        } catch (Throwable $exception) {
            $this->error('Could not import the release: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info(($result['built'] ? 'Imported' : 'Already present').': '.$result['release']);

        if (! $this->option('keep')) {
            // The build account only needs to read it; this account owns it.
            @unlink($archive);
        }

        return self::SUCCESS;
    }
}
