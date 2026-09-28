<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Models\HostingService;
use App\Services\FileManager\FileManagerService;
use App\Services\FileManager\FileManagerTransportException;
use Illuminate\Http\Request;

/**
 * The client dashboard's File Manager: browse, upload, extract a zip, create
 * a folder, delete, and download — all scoped to the site's own document
 * root via a hidden account the client never sees credentials for. See
 * FileManagerService for how paths are kept inside that root.
 */
class FileManagerController extends Controller
{
    private const PROVISIONING_MESSAGE = "Setting up your file manager — this takes about a minute the first time. Please try again shortly.";

    public function index(Request $request, HostingService $service, FileManagerService $files)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate([
            'path' => ['nullable', 'string', 'max:1000'],
            'hidden' => ['nullable', 'boolean'],
        ]);

        return $this->respond(fn () => $files->list($service, $payload['path'] ?? '', $request->boolean('hidden')));
    }

    public function upload(Request $request, HostingService $service, FileManagerService $files)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate([
            'path' => ['nullable', 'string', 'max:1000'],
            'file' => ['required', 'file', 'max:204800'], // 200MB
        ]);

        return $this->respond(fn () => $files->upload($service, $payload['path'] ?? '', $request->file('file')));
    }

    public function extract(Request $request, HostingService $service, FileManagerService $files)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate(['path' => ['required', 'string', 'max:1000']]);

        return $this->respond(fn () => $files->extractZip($service, $payload['path']));
    }

    public function makeDirectory(Request $request, HostingService $service, FileManagerService $files)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate([
            'path' => ['nullable', 'string', 'max:1000'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        return $this->respond(fn () => $files->makeDirectory($service, $payload['path'] ?? '', $payload['name']));
    }

    public function destroy(Request $request, HostingService $service, FileManagerService $files)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate(['path' => ['required', 'string', 'max:1000']]);

        return $this->respond(fn () => $files->delete($service, $payload['path']));
    }

    public function download(Request $request, HostingService $service, FileManagerService $files)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate(['path' => ['required', 'string', 'max:1000']]);

        try {
            $result = $files->prepareDownload($service, $payload['path']);
        } catch (FileManagerTransportException $exception) {
            abort(503, self::PROVISIONING_MESSAGE);
        }

        if (! $result['ready']) {
            abort(202, self::PROVISIONING_MESSAGE);
        }

        return response()->download($result['local_path'], basename($payload['path']))->deleteFileAfterSend(true);
    }

    private function respond(\Closure $action)
    {
        try {
            $result = $action();
        } catch (FileManagerTransportException $exception) {
            abort(503, self::PROVISIONING_MESSAGE);
        }

        if (! $result['ready']) {
            return response()->json(['message' => self::PROVISIONING_MESSAGE, 'ready' => false], 202);
        }

        return response()->json($result);
    }
}
