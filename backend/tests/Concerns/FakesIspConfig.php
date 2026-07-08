<?php

namespace Tests\Concerns;

use App\Services\Ispconfig\FakeIspConfigClient;
use App\Services\Ispconfig\IspConfigClient;

trait FakesIspConfig
{
    protected function fakeIspConfig(): FakeIspConfigClient
    {
        $fake = new FakeIspConfigClient;

        $this->app->instance(IspConfigClient::class, $fake);

        return $fake;
    }
}
