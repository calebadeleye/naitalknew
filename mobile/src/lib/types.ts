/*
 * Response shapes of /api/v1/greenmail — the same as the web app's
 * src/greenmail/api.ts (kept in step by hand; the API is the contract).
 */
export type Address = { name: string | null; email: string };

export type FolderRole = "inbox" | "sent" | "drafts" | "junk" | "trash" | "archive" | null;
export type Folder = { path: string; name: string; role: FolderRole; unread: number; total: number };

export type MessageSummary = {
  uid: number;
  subject: string;
  from: Address;
  to: Address[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  has_attachments: boolean;
  snippet: string;
};

export type Attachment = { index: number; name: string; size: number; mime: string; content_id: string | null; inline: boolean };

export type FullMessage = MessageSummary & {
  cc: Address[];
  reply_to: Address[];
  message_id: string;
  references: string;
  html: string;
  text: string | null;
  has_remote_images: boolean;
  attachments: Attachment[];
};

export type ListFilter = "all" | "unread" | "flagged" | "attachments";
export type ListPage = { messages: MessageSummary[]; total: number; page: number; per_page?: number; last_page: number };

export type Contact = { id: number; name: string | null; email: string; phone: string | null; company: string | null; notes: string | null };

export type Me = {
  email: string;
  display_name: string | null;
  signature_html: string | null;
  quota: { used_bytes: number; limit_bytes: number } | null;
  recovery_email?: string | null;
  recovery_email_verified?: boolean;
};

export type CalendarEvent = { id: number; title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string | null; notes: string | null };
export type Task = { id: number; title: string; due_date: string | null; done: boolean; completed_at: string | null; notes: string | null };
export type Note = { id: number; title: string | null; body: string | null; color: "yellow" | "green" | "blue" | "pink" | "gray" | null; pinned: boolean; updated_at: string };
export type Template = { id: number; name: string; subject: string | null; body_html: string | null };

export type RuleKind = "filter" | "automation";
export type MailRule = {
  id: number;
  kind: RuleKind;
  name: string;
  field: "any" | "from" | "to" | "subject";
  operator: "contains" | "is" | "begins" | "ends";
  value: string | null;
  action: "move" | "delete" | "mark_read" | "star" | "forward" | "auto_reply";
  target: string | null;
  reply_subject: string | null;
  reply_text: string | null;
  active: boolean;
};

export type Vacation = { enabled: boolean; subject: string; message: string; starts_at: string | null; ends_at: string | null; open_ended: boolean };

export type ScheduledEmail = { id: number; subject: string | null; recipients: string[]; send_at: string; status: "scheduled" | "sending" | "sent" | "failed" | "cancelled"; error: string | null; sent_at: string | null };

export type Campaign = {
  id: number;
  name: string;
  subject: string;
  status: "draft" | "sending" | "sent" | "cancelled" | "failed";
  send_at: string | null;
  total: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
};

export type AssistantAction = "summarise" | "draft_reply" | "action_items" | "translate_yoruba";

/** A file picked on the phone, to upload with an email. */
export type LocalFile = { uri: string; name: string; mime: string; size?: number | null };

/** What the composer sends to /send, /drafts or /scheduled. */
export type ComposePayload = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  in_reply_to?: string;
  references?: string;
  reply_uid?: number;
  reply_folder?: string;
  draft_uid?: number;
  forward_folder?: string;
  forward_uid?: number;
  forward_attachments?: number[];
  send_at?: string;
  attachments?: LocalFile[];
};
