// Fake Resend adapter for tests and ordinary local acceptance.
//
// Records every send and every body fetch. Supports:
//   - forcing the next send to fail with a specific error code
//   - replay detection via idempotency key
//   - scripted received emails keyed by sender/email_id
//
// This is the default adapter used by the local acceptance run. Provider
// contract tests (which need to exercise the real Resend API) live behind
// a separate task and are not part of `mise run acceptance`.

import {
  ResendError,
  type OutboundEmail,
  type OutboundResult,
  type ReceivedAttachmentBytes,
  type ReceivedEmailBody,
  type ReceivedEmailMetadata,
  type ResendAdapter,
} from "./resend.js";

export interface SentRecord extends OutboundEmail {
  readonly sentAt: string;
  readonly providerMessageId: string;
}

export interface FakeResendOptions {
  /**
   * If set, the next send call will throw with this error code, and then
   * the failure will be cleared. Used to test transient retry / permanent
   * failure paths.
   */
  failNext?: "TRANSIENT" | "PERMANENT" | "RATE_LIMITED";
}

export class FakeResend implements ResendAdapter {
  readonly sent: SentRecord[] = [];
  readonly metadataFetches: string[] = [];
  readonly bodyFetches: string[] = [];
  readonly attachmentFetches: Array<{ emailId: string; attachmentId: string }> = [];
  private readonly receivedEmails = new Map<string, FakeReceivedEmail>();
  private failureQueue: FakeResendOptions["failNext"] | null = null;

  constructor(initialOptions: FakeResendOptions = {}) {
    if (initialOptions.failNext) {
      this.failureQueue = initialOptions.failNext;
    }
  }

  /** Inject a received email for tests. */
  injectReceived(email: FakeReceivedEmail): void {
    this.receivedEmails.set(email.metadata.emailId, email);
  }

  /** Script the next send to fail. */
  failNext(code: FakeResendOptions["failNext"]): void {
    this.failureQueue = code;
  }

  async send(email: OutboundEmail): Promise<OutboundResult> {
    if (this.failureQueue) {
      const code = this.failureQueue;
      this.failureQueue = null;
      throw new ResendError(code, `Forced failure: ${code}`);
    }

    // Idempotency: same idempotencyKey returns the same providerMessageId.
    const existing = this.sent.find((s) => s.idempotencyKey === email.idempotencyKey);
    if (existing) {
      return { providerMessageId: existing.providerMessageId };
    }

    const record: SentRecord = {
      ...email,
      sentAt: new Date().toISOString(),
      providerMessageId: `fake_${Math.random().toString(36).slice(2, 10)}`,
    };
    this.sent.push(record);
    return { providerMessageId: record.providerMessageId };
  }

  async getReceivedMetadata(emailId: string): Promise<ReceivedEmailMetadata> {
    this.metadataFetches.push(emailId);
    const email = this.receivedEmails.get(emailId);
    if (!email) {
      throw new ResendError("PERMANENT", `Unknown email_id: ${emailId}`);
    }
    return email.metadata;
  }

  async getReceivedBody(emailId: string): Promise<ReceivedEmailBody> {
    this.bodyFetches.push(emailId);
    const email = this.receivedEmails.get(emailId);
    if (!email) {
      throw new ResendError("PERMANENT", `Unknown email_id: ${emailId}`);
    }
    return {
      html: email.html,
      text: email.text,
      headers: email.headers,
    };
  }

  async getReceivedAttachment(input: {
    emailId: string;
    attachmentId: string;
  }): Promise<ReceivedAttachmentBytes> {
    this.attachmentFetches.push(input);
    const email = this.receivedEmails.get(input.emailId);
    if (!email) {
      throw new ResendError("PERMANENT", `Unknown email_id: ${input.emailId}`);
    }
    const attachment = email.attachments.find((a) => a.id === input.attachmentId);
    if (!attachment) {
      throw new ResendError("PERMANENT", `Unknown attachment_id: ${input.attachmentId}`);
    }
    return attachment;
  }
}

export interface FakeReceivedEmail {
  readonly metadata: ReceivedEmailMetadata;
  readonly html: string | null;
  readonly text: string | null;
  readonly headers: Record<string, string>;
  readonly attachments: ReadonlyArray<ReceivedAttachmentBytes>;
}
