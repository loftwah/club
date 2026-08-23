// Resend adapter interface.
//
// Two directions:
//
//   1. Outbound: send an email. The interface is provider-agnostic so we
//      can swap to a fake in local acceptance. The real adapter uses the
//      Resend SDK; the fake records calls and supports failure injection.
//
//   2. Inbound: receive the email.received webhook and (separately) fetch
//      the message body via the Received Emails API. The webhook is
//      metadata only; the body fetch is required. See MASTER_SPEC §9.6.

export interface OutboundEmail {
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly replyTo?: string;
  readonly tags?: Record<string, string>;
  /** Idempotency key — used to dedupe sends on retry. */
  readonly idempotencyKey: string;
}

export interface OutboundResult {
  readonly providerMessageId: string;
}

export interface ReceivedEmailMetadata {
  readonly emailId: string;
  readonly from: string;
  readonly fromName: string | null;
  readonly to: ReadonlyArray<string>;
  readonly cc: ReadonlyArray<string>;
  readonly bcc: ReadonlyArray<string>;
  readonly subject: string;
  readonly messageId: string;
  readonly attachments: ReadonlyArray<{
    readonly id: string;
    readonly filename: string;
    readonly contentType: string;
    readonly contentDisposition: "inline" | "attachment";
  }>;
  /** ISO 8601 of when Resend received the message. */
  readonly receivedAt: string;
}

export interface ReceivedEmailBody {
  readonly html: string | null;
  readonly text: string | null;
  readonly headers: Record<string, string>;
}

export interface ReceivedAttachmentBytes {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
}

export interface ResendAdapter {
  send(email: OutboundEmail): Promise<OutboundResult>;
  getReceivedMetadata(emailId: string): Promise<ReceivedEmailMetadata>;
  getReceivedBody(emailId: string): Promise<ReceivedEmailBody>;
  getReceivedAttachment(input: {
    emailId: string;
    attachmentId: string;
  }): Promise<ReceivedAttachmentBytes>;
}

export class ResendError extends Error {
  constructor(
    public readonly code:
      "TRANSIENT" | "PERMANENT" | "RATE_LIMITED" | "INVALID_INPUT" | "WEBHOOK_SIGNATURE_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "ResendError";
  }
}
