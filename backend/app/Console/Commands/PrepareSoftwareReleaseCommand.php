<?php

namespace App\Console\Commands;

use App\Services\SoftwareInstall\SoftwareInstallOrchestrator;
use Illuminate\Console\Command;
use Throwable;

class PrepareSoftwareReleaseCommand extends Command
{
    protected $signature = 'software:prepare-release {slug=naipay : Catalog entry to prepare}';

    protected $description = 'Build the shared release of a Software catalog app on the build account ahead of any client install (a no-op if the current commit is already built).';

    public function handle(SoftwareInstallOrchestrator $orchestrator): int
    {
        $slug = (string) $this->argument('slug');

        $this->info("Preparing the {$slug} release — a first build takes many minutes on the capped build account...");

        try {
            $result = $orchestrator->prepareRelease($slug);
        } catch (Throwable $exception) {
            $this->error('Could not prepare the release: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info(($result['built'] ? 'Built' : 'Already built').': '.$result['release']);

        return self::SUCCESS;
    }
}
