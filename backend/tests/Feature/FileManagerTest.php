<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingFileManagerAccount;
use App\Models\HostingService;
use App\Services\FileManager\FakeFileManagerTransport;
use App\Services\FileManager\FileManagerTransport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class FileManagerTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    private function fakeTransport(): FakeFileManagerTransport
    {
        $fake = new FakeFileManagerTransport;
        $this->app->instance(FileManagerTransport::class, $fake);

        return $fake;
    }

    private function provisionedService($ispConfigFake): HostingService
    {
        $service = $this->createProvisionableHostingService();
        ProvisionHostingServiceJob::dispatch($service->id);

        return $service->fresh();
    }

    private function clientToken(HostingService $service): string
    {
        $user = $service->client->user;
        $user->forceFill(['password' => \Illuminate\Support\Facades\Hash::make('secret-password')])->save();

        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'secret-password'])
            ->assertOk()->json('token');
    }

    public function test_first_visit_provisions_the_hidden_account_and_reports_not_ready_yet(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files")
            ->assertStatus(202)
            ->assertJsonPath('ready', false);

        $account = HostingFileManagerAccount::where('hosting_service_id', $service->id)->firstOrFail();
        $this->assertSame('active', $account->status);
        $this->assertNotNull($account->ispconfig_shell_user_id);
        // The client never receives these credentials in any response.
        $this->assertStringNotContainsString($account->username, json_encode(['ready' => false]));
    }

    public function test_second_visit_connects_and_lists_the_site_root(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $fakeTransport = $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);

        // First call provisions the account (not ready yet)...
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files")->assertStatus(202);

        mkdir($fakeTransport->rootDir().'/web/wp-content');
        file_put_contents($fakeTransport->rootDir().'/web/index.html', 'hi');
        file_put_contents($fakeTransport->rootDir().'/web/.htaccess', 'secret-ish');

        // ...second call actually connects.
        $response = $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files")->assertOk();
        $names = collect($response->json('entries'))->pluck('name');

        $this->assertTrue($names->contains('wp-content'));
        $this->assertTrue($names->contains('index.html'));
        $this->assertFalse($names->contains('.htaccess'), 'hidden files must not show by default');

        $account = HostingFileManagerAccount::where('hosting_service_id', $service->id)->firstOrFail();
        $this->assertSame($account->username, $fakeTransport->connectCalls[0]['username']);
        $this->assertSame($account->password, $fakeTransport->connectCalls[0]['password']);
    }

    public function test_hidden_files_show_only_when_requested(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $fakeTransport = $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");
        file_put_contents($fakeTransport->rootDir().'/web/.env', 'SECRET=1');

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files")
            ->assertOk()->assertJsonMissing(['name' => '.env']);

        $shown = $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files?hidden=1")->assertOk();
        $this->assertTrue(collect($shown->json('entries'))->pluck('name')->contains('.env'));
    }

    public function test_client_can_navigate_into_a_subfolder(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $fakeTransport = $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");
        mkdir($fakeTransport->rootDir().'/web/photos', 0755, true);
        file_put_contents($fakeTransport->rootDir().'/web/photos/cat.jpg', 'x');

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files?path=photos")
            ->assertOk()->assertJsonPath('entries.0.name', 'cat.jpg');
    }

    public function test_path_cannot_escape_the_site_root(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files?".http_build_query(['path' => '../../etc']))
            ->assertStatus(422);
    }

    public function test_client_can_upload_a_file(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $fakeTransport = $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");

        $this->withToken($token)->post("/api/v1/client/services/{$service->id}/files/upload", [
            'file' => UploadedFile::fake()->create('picture.jpg', 50, 'image/jpeg'),
        ])->assertOk();

        $this->assertFileExists($fakeTransport->rootDir().'/web/picture.jpg');
    }

    public function test_uploading_a_zip_and_extracting_it_produces_its_contents(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $fakeTransport = $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");

        $zipPath = tempnam(sys_get_temp_dir(), 'fmtest').'.zip';
        $zip = new \ZipArchive;
        $zip->open($zipPath, \ZipArchive::CREATE);
        $zip->addFromString('hello.txt', 'hello world');
        $zip->addEmptyDir('nested');
        $zip->addFromString('nested/deep.txt', 'deep file');
        $zip->close();

        $this->withToken($token)->post("/api/v1/client/services/{$service->id}/files/upload", [
            'file' => new UploadedFile($zipPath, 'site.zip', 'application/zip', null, true),
        ])->assertOk();

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/files/extract", ['path' => 'site.zip'])
            ->assertOk()->assertJsonPath('ok', true);

        $this->assertFileExists($fakeTransport->rootDir().'/web/hello.txt');
        $this->assertSame('hello world', file_get_contents($fakeTransport->rootDir().'/web/hello.txt'));
        $this->assertFileExists($fakeTransport->rootDir().'/web/nested/deep.txt');
    }

    public function test_only_zip_files_can_be_extracted(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $fakeTransport = $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");
        file_put_contents($fakeTransport->rootDir().'/web/notes.txt', 'hi');

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/files/extract", ['path' => 'notes.txt'])
            ->assertStatus(422);
    }

    public function test_client_can_create_a_folder_and_delete_it(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $fakeTransport = $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");

        $this->withToken($token)->postJson("/api/v1/client/services/{$service->id}/files/mkdir", ['name' => 'backups'])->assertOk();
        $this->assertDirectoryExists($fakeTransport->rootDir().'/web/backups');

        $this->withToken($token)->deleteJson("/api/v1/client/services/{$service->id}/files", ['path' => 'backups'])->assertOk();
        $this->assertDirectoryDoesNotExist($fakeTransport->rootDir().'/web/backups');
    }

    public function test_the_site_root_itself_cannot_be_deleted(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $token = $this->clientToken($service);
        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files");

        $this->withToken($token)->deleteJson("/api/v1/client/services/{$service->id}/files", ['path' => ''])->assertStatus(422);
        $this->withToken($token)->deleteJson("/api/v1/client/services/{$service->id}/files", ['path' => '/'])->assertStatus(422);
    }

    public function test_client_cannot_manage_another_clients_files(): void
    {
        $ispConfigFake = $this->fakeIspConfig();
        $this->fakeTransport();
        $service = $this->provisionedService($ispConfigFake);
        $intruder = \App\Models\User::factory()->create(['role' => 'client', 'account_status' => 'active', 'email_verified_at' => now(), 'password' => \Illuminate\Support\Facades\Hash::make('secret-password')]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $intruder->email, 'password' => 'secret-password'])->assertOk()->json('token');

        $this->withToken($token)->getJson("/api/v1/client/services/{$service->id}/files")->assertForbidden();
    }
}
