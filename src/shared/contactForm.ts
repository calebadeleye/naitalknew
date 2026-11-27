import { laravelApi } from "./api";

/**
 * Sends a contact-form message to the platform, which saves it and emails
 * NAI TALK. (It used to go through the Node server's own SMTP login, which
 * silently broke when the mailbox password changed.)
 */
export async function sendContactMessage(
  form: { name: string; email: string; service: string; details: string; phone?: string },
  turnstileToken: string,
  page: string,
): Promise<string> {
  const data = await laravelApi<{ message: string }>("/api/v1/public/contact", undefined, {
    method: "POST",
    body: JSON.stringify({ ...form, page, turnstile_token: turnstileToken || undefined }),
  });
  return data.message;
}
