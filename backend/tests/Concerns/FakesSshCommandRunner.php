<?php

namespace Tests\Concerns;

use App\Services\SoftwareInstall\FakeSshCommandRunner;
use App\Services\SoftwareInstall\SshCommandRunner;

trait FakesSshCommandRunner
{
    protected const FAKE_RELEASE_SHA = 'abcdef0123456789abcdef0123456789abcdef01';

    protected function fakeSshCommandRunner(): FakeSshCommandRunner
    {
        $fake = new FakeSshCommandRunner;

        // What the real build account would answer for the release/deploy
        // discovery commands; individual tests override these as needed.
        $fake->respond('git ls-remote', 0, self::FAKE_RELEASE_SHA."\trefs/heads/main\n");
        $fake->respond('git rev-parse HEAD', 0, self::FAKE_RELEASE_SHA."\n");
        $fake->respond('getent passwd', 0, "/var/www/clients/client1/web1/home/sw-test\n");

        $this->app->instance(SshCommandRunner::class, $fake);

        return $fake;
    }
}
