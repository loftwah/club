// Real Resend adapter. Uses the official Resend SDK to send emails and
// the Resend HTTP API to fetch the body of inbound messages.
//
// IMPORTANT: The `email.received` webhook from Resend is metadata only.
// The body and attachments must be fetched via the API. See MASTER_SPEC
// §9.6 and docs/08_RESEND_EMAIL_CALENDAR.md.

import { Resend } from "resend";
import {
  ResendError,
  type OutboundEmail,
  type OutboundResult,
  type ReceivedAttachmentBytes,
  type ReceivedEmailBody,
  type ReceivedEmailMetadata,
  type ResendAdapter,
} from "./resend.js";

export interface RealResendOptions {
  readonly apiKey: string;
  readonly fetchImpl?: typeof fetch;
  /** Override the Resend API base URL. Defaults to https://api.resend.com. */
  readonly baseUrl?: string;
  /** Exact HTTPS origins allowed to serve attachment bytes. Defaults to the API origin. */
  readonly attachmentDownloadOrigins?: readonly string[];
  /** Maximum decoded attachment size. Defaults to 25 MiB. */
  readonly maxAttachmentBytes?: number;
  /** Attachment download timeout in milliseconds. Defaults to 15 seconds. */
  readonly attachmentTimeoutMs?: number;
}

interface ResendErrorResponse {
  statusCode?: number;
  message?: string;
  name?: string;
}

interface ResendReceivedResponse {
  id: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string>;
  created_at?: string;
  message_id?: string;
  attachments?: Array<{
    id: string;
    filename?: string;
    content_type?: string;
    content_disposition?: "inline" | "attachment";
    download_url?: string;
    content?: string;
  }>;
}

export class RealResendAdapter implements ResendAdapter {
  private readonly client: Resend;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly attachmentDownloadOrigins: ReadonlySet<string>;
  private readonly maxAttachmentBytes: number;
  private readonly attachmentTimeoutMs: number;

  constructor(opts: RealResendOptions) {
    this.apiKey = opts.apiKey;
    this.client = new Resend(opts.apiKey);
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.baseUrl = opts.baseUrl ?? "https://api.resend.com";
    const apiOrigin = new URL(this.baseUrl).origin;
    this.attachmentDownloadOrigins = new Set(opts.attachmentDownloadOrigins ?? [apiOrigin]);
    this.maxAttachmentBytes = opts.maxAttachmentBytes ?? 25 * 1024 * 1024;
    this.attachmentTimeoutMs = opts.attachmentTimeoutMs ?? 15_000;
  }

  async send(email: OutboundEmail): Promise<OutboundResult> {
    try {
      const result = await this.client.emails.send(
        {
          to: email.to,
          from: email.from,
          subject: email.subject,
          html: email.html,
          text: email.text,
          replyTo: email.replyTo,
          tags: email.tags
            ? Object.entries(email.tags).map(([name, value]) => ({ name, value }))
            : undefined,
        },
        {
          idempotencyKey: email.idempotencyKey,
        },
      );
      if (result.error) {
        const code = classifyError(result.error);
        throw new ResendError(code, result.error.message ?? "Resend send failed");
      }
      if (!result.data) {
        throw new ResendError("PERMANENT", "Resend returned no data");
      }
      return { providerMessageId: result.data.id };
    } catch (err) {
      if (err instanceof ResendError) throw err;
      throw new ResendError("TRANSIENT", String(err));
    }
  }

  private async getReceived(emailId: string): Promise<ResendReceivedResponse> {
    // Resend's SDK surface for the Receiving API has changed across
    // versions. We hit the documented HTTP endpoint directly so we are
    // robust to that and to per-account differences. The endpoint is
    //   GET {base}/emails/receiving/{email_id}
    // authenticated with a Bearer token.
    const url = `${this.baseUrl}/emails/receiving/${encodeURIComponent(emailId)}`;
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as ResendErrorResponse;
      throw new ResendError(
        classifyError(errBody),
        errBody.message ?? `Resend receiving.get failed (${response.status})`,
      );
    }
    return (await response.json()) as ResendReceivedResponse;
  }

  async getReceivedMetadata(emailId: string): Promise<ReceivedEmailMetadata> {
    const data = await this.getReceived(emailId);
    return mapMetadata(data);
  }

  async getReceivedBody(emailId: string): Promise<ReceivedEmailBody> {
    const data = await this.getReceived(emailId);
    return {
      html: data.html ?? null,
      text: data.text ?? null,
      headers: data.headers ?? {},
    };
  }

  async getReceivedAttachment(input: {
    emailId: string;
    attachmentId: string;
  }): Promise<ReceivedAttachmentBytes> {
    // The attachments API returns a download URL or inline base64
    // content. We fetch the metadata first, then download the bytes.
    const data = await this.getReceived(input.emailId);
    const attachment = data.attachments?.find((a) => a.id === input.attachmentId);
    if (!attachment) {
      throw new ResendError("PERMANENT", `Unknown attachment_id: ${input.attachmentId}`);
    }
    if (attachment.content) {
      return {
        id: attachment.id,
        filename: attachment.filename ?? "untitled",
        contentType: attachment.content_type ?? "application/octet-stream",
        bytes: base64ToBytes(attachment.content),
      };
    }
    if (attachment.download_url) {
      const downloadUrl = new URL(attachment.download_url);
      if (
        downloadUrl.protocol !== "https:" ||
        downloadUrl.username ||
        downloadUrl.password ||
        !this.attachmentDownloadOrigins.has(downloadUrl.origin)
      ) {
        throw new ResendError("PERMANENT", "Attachment download origin is not allowlisted");
      }
      const response = await this.fetchImpl(downloadUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(this.attachmentTimeoutMs),
      });
      if (!response.ok) {
        throw new ResendError("PERMANENT", `Resend attachment fetch failed (${response.status})`);
      }
      const advertisedLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(advertisedLength) && advertisedLength > this.maxAttachmentBytes) {
        throw new ResendError("PERMANENT", "Resend attachment exceeds the size limit");
      }
      const buf = new Uint8Array(await response.arrayBuffer());
      if (buf.byteLength > this.maxAttachmentBytes) {
        throw new ResendError("PERMANENT", "Resend attachment exceeds the size limit");
      }
      return {
        id: attachment.id,
        filename: attachment.filename ?? "untitled",
        contentType: attachment.content_type ?? "application/octet-stream",
        bytes: buf,
      };
    }
    throw new ResendError("PERMANENT", "Attachment has no inline content or download URL");
  }
}

function mapMetadata(data: ResendReceivedResponse): ReceivedEmailMetadata {
  return {
    emailId: data.id,
    from: data.from ?? "",
    fromName: null,
    to: data.to ?? [],
    cc: data.cc ?? [],
    bcc: data.bcc ?? [],
    subject: data.subject ?? "",
    messageId: data.message_id ?? "",
    attachments: (data.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename ?? "untitled",
      contentType: a.content_type ?? "application/octet-stream",
      contentDisposition: a.content_disposition === "inline" ? "inline" : "attachment",
    })),
    receivedAt: data.created_at ?? new Date().toISOString(),
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

function classifyError(error: { statusCode?: number; name?: string }): ResendError["code"] {
  const code = error.statusCode;
  if (code === 429) return "RATE_LIMITED";
  if (code === 400 || code === 422) return "INVALID_INPUT";
  if (code && code >= 500) return "TRANSIENT";
  if (code && code >= 400) return "PERMANENT";
  return "TRANSIENT";
}
