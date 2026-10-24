import type {
  AssistantAction,
  CalendarEvent,
  Campaign,
  ComposePayload,
  Contact,
  Folder,
  FullMessage,
  ListFilter,
  ListPage,
  MailRule,
  Me,
  Note,
  RuleKind,
  ScheduledEmail,
  Task,
  Template,
  Vacation,
} from "./types";

/*
 * Green Mail API client. Every request after sign-in carries the mailbox's
 * token in X-Greenmail-Token. Errors come in three kinds the app treats
 * differently (the outbox especially):
 *  - SessionExpired: 401 — sign in again;
 *  - NetworkError: no answer at all (offline, timeout) — try again later;
 *  - ApiError: the server said no; `retryable` for 5xx/429.
 */
export class SessionExpired extends Error {
  readonly name = "SessionExpired";
}

export class NetworkError extends Error {
  readonly name = "NetworkError";
}

export class ApiError extends Error {
  readonly name = "ApiError";
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }

  get retryable(): boolean {
    return this.status >= 500 || this.status === 429 || this.status === 408;
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ClientConfig = {
  baseUrl: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  /**
   * Called when the server says a token has expired (401). Returns a fresh token
   * (signed in again from the saved password) or null. The request is then
   * repeated once with the fresh token, so screens never notice a session ending.
   */
  onSessionExpired?: (expiredToken: string) => Promise<string | null>;
};

export function buildQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Compose fields as multipart form data (how the web app sends them, so attachments ride along). */
export function composeForm(payload: ComposePayload): FormData {
  const data = new FormData();
  data.append("to", payload.to ?? "");
  data.append("cc", payload.cc ?? "");
  data.append("bcc", payload.bcc ?? "");
  data.append("subject", payload.subject ?? "");
  data.append("html", payload.html ?? "");
  const optional: Array<keyof ComposePayload> = ["in_reply_to", "references", "reply_uid", "reply_folder", "draft_uid", "forward_folder", "forward_uid", "send_at"];
  for (const key of optional) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== "") data.append(key, String(value));
  }
  for (const index of payload.forward_attachments ?? []) data.append("forward_attachments[]", String(index));
  for (const file of payload.attachments ?? []) {
    // React Native's FormData takes {uri, name, type} for a file on the device.
    data.append("attachments[]", { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
  }
  return data;
}

function firstError(payload: { message?: string; errors?: Record<string, string[]> }): string | undefined {
  if (!payload.errors) return undefined;
  const first = Object.values(payload.errors)[0];
  return Array.isArray(first) ? first[0] : undefined;
}

export function createClient(config: ClientConfig) {
  const doFetch: FetchLike = config.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = config.timeoutMs ?? 30000;
  const base = config.baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, token: string | null, options: RequestOptions = {}, retried = false): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["X-Greenmail-Token"] = token;

    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response: Response;
    try {
      response = await doFetch(`${base}${path}${buildQuery(options.query)}`, { method: options.method ?? "GET", headers, body, signal: controller?.signal });
    } catch (error) {
      throw new NetworkError(error instanceof Error && error.name === "AbortError" ? "The server took too long to answer." : "No connection. Check your internet and try again.");
    } finally {
      if (timer) clearTimeout(timer);
    }

    const payload = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };

    if (response.status === 401 && token) {
      const fresh = !retried && config.onSessionExpired ? await config.onSessionExpired(token).catch(() => null) : null;
      if (fresh && fresh !== token) return request<T>(path, fresh, options, true);
      throw new SessionExpired(payload.message || "Please sign in again.");
    }
    if (!response.ok) {
      throw new ApiError(firstError(payload) || payload.message || "Something went wrong. Please try again.", response.status, payload.errors ?? {});
    }
    return payload as T;
  }

  /** Raw download (attachments): returns the response for the caller to save. */
  async function download(path: string, token: string, query?: RequestOptions["query"]): Promise<Response> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}${buildQuery(query)}`, { headers: { "X-Greenmail-Token": token } });
    } catch {
      throw new NetworkError("No connection. Check your internet and try again.");
    }
    if (response.status === 401) throw new SessionExpired("Please sign in again.");
    if (!response.ok) throw new ApiError("Download failed.", response.status);
    return response;
  }

  return {
    baseUrl: base,
    request,
    download,
    url: (path: string, query?: RequestOptions["query"]) => `${base}${path}${buildQuery(query)}`,

    signIn: (email: string, password: string) =>
      request<{ token: string; email: string; expires_at: string }>("/session", null, { method: "POST", body: { email: email.trim(), password } }),
    me: (token: string) => request<Me>("/session", token),
    signOut: (token: string) => request<{ message: string }>("/session", token, { method: "DELETE" }),
    forgotPassword: (email: string) => request<{ message: string }>("/password/forgot", null, { method: "POST", body: { email } }),
    resetPassword: (email: string, code: string, password: string) =>
      request<{ message: string }>("/password/reset", null, { method: "POST", body: { email, code, password, password_confirmation: password } }),
    changePassword: (token: string, current: string, password: string) =>
      request<{ message: string }>("/password", token, { method: "POST", body: { current_password: current, password, password_confirmation: password } }),
    requestAccountDeletion: (token: string, password: string) =>
      request<{ message: string }>("/account/deletion-request", token, { method: "POST", body: { password } }),
    setRecoveryEmail: (token: string, email: string | null) => request<{ message: string }>("/recovery-email", token, { method: "PUT", body: { recovery_email: email } }),
    confirmRecoveryEmail: (token: string, code: string) => request<{ message: string }>("/recovery-email/confirm", token, { method: "POST", body: { code } }),
    updateSettings: (token: string, settings: { display_name?: string | null; signature_html?: string | null }) =>
      request<{ display_name: string | null; signature_html: string | null }>("/settings", token, { method: "PUT", body: settings }),

    folders: (token: string) => request<{ folders: Folder[]; starred: number }>("/folders", token),
    messages: (token: string, folder: string, page = 1, filter: ListFilter = "all", q?: string) =>
      request<ListPage>("/messages", token, { query: { folder, page, filter, q } }),
    message: (token: string, folder: string, uid: number) => request<FullMessage>(`/messages/${uid}`, token, { query: { folder } }),
    updateMessage: (token: string, folder: string, uid: number, change: { seen?: boolean; flagged?: boolean }) =>
      request<{ message: string }>(`/messages/${uid}`, token, { method: "PATCH", body: { folder, ...change } }),
    moveMessage: (token: string, folder: string, uid: number, target: { to?: string; to_role?: "archive" | "junk" | "inbox" | "trash" }) =>
      request<{ message: string; to: string }>(`/messages/${uid}/move`, token, { method: "POST", body: { folder, ...target } }),
    deleteMessage: (token: string, folder: string, uid: number) => request<{ message: string }>(`/messages/${uid}`, token, { method: "DELETE", query: { folder } }),
    check: (token: string, since: number) =>
      request<{ folder: string; latest_uid: number; new: Array<{ uid: number; subject: string; from: { name: string | null; email: string } }> }>("/check", token, { query: { since } }),

    send: (token: string, payload: ComposePayload) => request<{ message: string }>("/send", token, { method: "POST", body: composeForm(payload) }),
    saveDraft: (token: string, payload: ComposePayload) => request<{ message: string }>("/drafts", token, { method: "POST", body: composeForm(payload) }),
    schedule: (token: string, payload: ComposePayload) => request<{ message: string; scheduled: ScheduledEmail }>("/scheduled", token, { method: "POST", body: composeForm(payload) }),
    scheduled: (token: string) => request<{ scheduled: ScheduledEmail[] }>("/scheduled", token),
    cancelScheduled: (token: string, id: number) => request<{ message: string }>(`/scheduled/${id}`, token, { method: "DELETE" }),

    contacts: (token: string, q?: string) => request<{ contacts: Contact[] }>("/contacts", token, { query: { q } }),
    assistant: (token: string, action: AssistantAction, folder: string, uid: number) =>
      request<{ reply: string }>("/assistant", token, { method: "POST", body: { action, folder, uid } }),

    events: (token: string, from: Date, to: Date) => request<{ events: CalendarEvent[] }>("/events", token, { query: { from: from.toISOString(), to: to.toISOString() } }),
    saveEvent: (token: string, event: Partial<CalendarEvent> & { title: string; starts_at: string }) =>
      event.id
        ? request<{ event: CalendarEvent }>(`/events/${event.id}`, token, { method: "PUT", body: event })
        : request<{ event: CalendarEvent }>("/events", token, { method: "POST", body: event }),
    deleteEvent: (token: string, id: number) => request<{ message: string }>(`/events/${id}`, token, { method: "DELETE" }),

    tasks: (token: string, status: "open" | "done" | "all" = "all") => request<{ tasks: Task[] }>("/tasks", token, { query: { status } }),
    createTask: (token: string, task: { title: string; due_date?: string | null; notes?: string | null }) => request<{ task: Task }>("/tasks", token, { method: "POST", body: task }),
    updateTask: (token: string, id: number, change: Partial<Pick<Task, "title" | "due_date" | "done" | "notes">>) =>
      request<{ task: Task }>(`/tasks/${id}`, token, { method: "PATCH", body: change }),
    deleteTask: (token: string, id: number) => request<{ message: string }>(`/tasks/${id}`, token, { method: "DELETE" }),

    notes: (token: string, q?: string) => request<{ notes: Note[] }>("/notes", token, { query: { q } }),
    saveNote: (token: string, note: Partial<Note>) =>
      note.id
        ? request<{ note: Note }>(`/notes/${note.id}`, token, { method: "PUT", body: note })
        : request<{ note: Note }>("/notes", token, { method: "POST", body: note }),
    deleteNote: (token: string, id: number) => request<{ message: string }>(`/notes/${id}`, token, { method: "DELETE" }),

    templates: (token: string) => request<{ templates: Template[] }>("/templates", token),
    saveTemplate: (token: string, template: Partial<Template> & { name: string }) =>
      template.id
        ? request<{ template: Template }>(`/templates/${template.id}`, token, { method: "PUT", body: template })
        : request<{ template: Template }>("/templates", token, { method: "POST", body: template }),
    deleteTemplate: (token: string, id: number) => request<{ message: string }>(`/templates/${id}`, token, { method: "DELETE" }),

    rules: (token: string, kind: RuleKind) => request<{ rules: MailRule[] }>("/rules", token, { query: { kind } }),
    saveRule: (token: string, rule: Omit<MailRule, "id"> & { id?: number }) =>
      rule.id
        ? request<{ message: string }>(`/rules/${rule.id}`, token, { method: "PUT", body: rule })
        : request<{ message: string }>("/rules", token, { method: "POST", body: rule }),
    toggleRule: (token: string, id: number, active: boolean) => request<{ message: string }>(`/rules/${id}`, token, { method: "PUT", body: { active } }),
    deleteRule: (token: string, id: number) => request<{ message: string }>(`/rules/${id}`, token, { method: "DELETE" }),
    vacation: (token: string) => request<{ vacation: Vacation }>("/vacation", token),
    saveVacation: (token: string, vacation: Vacation) => request<{ vacation: Vacation; message: string }>("/vacation", token, { method: "PUT", body: vacation }),

    campaigns: (token: string) => request<{ campaigns: Campaign[] }>("/campaigns", token),

    registerPush: (token: string, pushToken: string, platform: "ios" | "android") =>
      request<{ message: string }>("/push/expo", token, { method: "POST", body: { token: pushToken, platform } }),
    unregisterPush: (token: string, pushToken: string) => request<{ message: string }>("/push/expo", token, { method: "DELETE", body: { token: pushToken } }),
    testPush: (token: string, pushToken: string) => request<{ message: string }>("/push/expo/test", token, { method: "POST", body: { token: pushToken } }),
  };
}

export type GreenmailClient = ReturnType<typeof createClient>;

export const DEFAULT_BASE_URL = "https://www.naitalk.com/api/v1/greenmail";
