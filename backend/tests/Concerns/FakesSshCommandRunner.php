<?php

namespace Tests\Concerns;

use App\Services\SoftwareInstall\FakeSshCommandRunner;
use App\Services\SoftwareInstall\SshCommandRunner;

trait FakesSshCommandRunner
{
    protected function fakeSshCommandRunner(): FakeSshCommandRunner
    {
        $fake = new FakeSshCommandRunner;

        $this->app->instance(SshCommandRunner::class, $fake);

        return $fake;
    }
}
