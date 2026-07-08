<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Jobs\DatabaseProvisioningActionJob;
use App\Models\DatabaseRecord;
use App\Models\HostingService;
use Illuminate\Http\Request;

class DatabaseController extends Controller
{
    public function index(Request $request, HostingService $service)
    {
        $this->authorize('viewAny', [DatabaseRecord::class, $service]);

        return response()->json([
            'databases' => $service->databaseRecords()->get(),
            'limit' => (int) ($service->hostingPlan?->configuration()['max_databases'] ?? 0),
        ]);
    }

    public function store(Request $request, HostingService $service)
    {
        $this->authorize('create', [DatabaseRecord::class, $service]);

        $payload = $request->validate([
            'database_name' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_]+$/'],
            'username' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9_]+$/'],
            'password' => ['required', 'string', 'min:10', 'max:255'],
        ]);

        abort_if(
            DatabaseRecord::query()->where('hosting_service_id', $service->id)->where('database_name', $payload['database_name'])->exists(),
            422,
            'A database with this name already exists.',
        );

        $database = DatabaseRecord::query()->create([
            'hosting_service_id' => $service->id,
            'database_name' => $payload['database_name'],
            'username' => $payload['username'],
            'status' => 'provisioning',
        ]);

        DatabaseProvisioningActionJob::dispatch($database->id, 'create', ['password' => $payload['password']]);

        return response()->json($database, 202);
    }

    public function resetPassword(Request $request, HostingService $service, DatabaseRecord $database)
    {
        $this->authorize('update', $database);
        abort_if($database->hosting_service_id !== $service->id, 404);

        $payload = $request->validate([
            'password' => ['required', 'string', 'min:10', 'max:255', 'confirmed'],
        ]);

        DatabaseProvisioningActionJob::dispatch($database->id, 'reset_password', ['password' => $payload['password']]);

        return response()->json(['message' => 'Database password reset requested.'], 202);
    }

    public function destroy(Request $request, HostingService $service, DatabaseRecord $database)
    {
        $this->authorize('delete', $database);
        abort_if($database->hosting_service_id !== $service->id, 404);

        $request->validate(['confirm' => ['required', 'accepted']]);

        $database->forceFill(['status' => 'provisioning'])->save();

        DatabaseProvisioningActionJob::dispatch($database->id, 'delete');

        return response()->json(['message' => 'Database deletion requested.'], 202);
    }
}
