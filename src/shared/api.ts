export const LARAVEL_API_BASE_URL =
  (import.meta.env.VITE_LARAVEL_API_URL as string | undefined)?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export async function laravelApi<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  // FormData (file uploads) must keep the browser's own multipart Content-Type.
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${LARAVEL_API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Laravel API request failed");
  }

  return payload as T;
}

/** Downloads a file from an authenticated API endpoint and hands it to the browser to save. */
export async function downloadLaravelFile(path: string, token: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${LARAVEL_API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Download failed.");
  }

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}
