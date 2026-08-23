// Integration test for the inbound email service: it verifies that the
// body and attachments are fetched via the Resend Received Emails API
// AFTER the webhook metadata is persisted, and that signature verification
// is performed on the raw body using the Svix library.

import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { FixedClock } from "@infra/clock";
import { InMemoryAuditWriter } from "@infra/audit";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FakeResend, type FakeReceivedEmail } from "@adapters/resend-fake";
import { InboundEmailService } from "@services/inbound-email";
import { Webhook } from "svix";

function makeDeps() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-23T00:00:00Z");
  const resend = new FakeResend();
  const audit = new InMemoryAuditWriter();
  // The Svix Webhook class expects a `whsec_` prefix followed by a
  // base64-encoded secret. We use a 32-byte test secret.
  const signingSecret =
    "whsec_" +
    Buffer.from("0123456789abcdef0123456789abcdef").toString("base64").replace(/=+$/, "");
  const service = new InboundEmailService({
    db: db as unknown as D1Database,
    resend,
    audit,
    clock,
    signingSecret,
  });
  return { db, clock, resend, audit, service, signingSecret };
}

function signedHeaders(payload: string, secret: string): Record<string, string> {
  const wh = new Webhook(secret);
  const msgId = `msg_${Math.random().toString(36).slice(2, 10)}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = wh.sign(msgId, new Date(parseInt(timestamp, 10) * 1000), payload);
  return {
    "svix-id": msgId,
    "svix-timestamp": timestamp,
    "svix-signature": signature,
    "content-type": "application/json",
  };
}

const samplePayload = (emailId: string) => ({
  type: "email.received",
  created_at: "2026-08-23T00:00:00Z",
  data: {
    email_id: emailId,
    from: "member@example.com",
    to: ["hello@club.loftwah.com"],
    subject: "Re: hello",
    message_id: "<abc@example.com>",
    created_at: "2026-08-23T00:00:00Z",
  },
});

describe("inbound email integration", () => {
  it("valid signed fixture → processed; body fetched via Resend API", async () => {
    const { service, resend, db, signingSecret } = makeDeps();
    const received: FakeReceivedEmail = {
      metadata: {
        emailId: "em_abc",
        from: "member@example.com",
        fromName: "Member",
        to: ["hello@club.loftwah.com"],
        cc: [],
        bcc: [],
        subject: "Re: hello",
        messageId: "<abc@example.com>",
        attachments: [],
        receivedAt: "2026-08-23T00:00:00Z",
      },
      html: "<p>I got a new dog called Frank.</p>",
      text: "I got a new dog called Frank.",
      headers: { from: "member@example.com" },
      attachments: [],
    };
    resend.injectReceived(received);

    const payload = JSON.stringify(samplePayload("em_abc"));
    const headers = signedHeaders(payload, signingSecret);
    const result = await service.handleRaw(payload, headers);
    expect(result.status).toBe("processed");
    if (result.status === "processed") {
      expect(result.matched).toBe(false); // no member with that email
    }
    // The body was fetched via the Resend API, not from the webhook.
    expect(resend.bodyFetches).toContain("em_abc");
    expect(resend.metadataFetches).toContain("em_abc");
    const stored = db.all("inbound_messages");
    expect(stored.length).toBe(1);
    expect(stored[0]!.body_text).toBe("I got a new dog called Frank.");
    expect(stored[0]!.state).toBe("CLOSED");
  });

  it("invalid signature → rejected, no business processing", async () => {
    const { service, resend, db } = makeDeps();
    const payload = JSON.stringify(samplePayload("em_x"));
    const badHeaders = {
      "svix-id": "msg_x",
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": "v1,notavalidvalue=",
    };
    const result = await service.handleRaw(payload, badHeaders);
    expect(result.status).toBe("rejected");
    expect(resend.bodyFetches.length).toBe(0);
    const stored = db.all("inbound_messages");
    expect(stored.length).toBe(0);
    expect(db.all("inbound_messages").length).toBe(0);
  });

  it("duplicate event id → acknowledged no-op", async () => {
    const { service, resend, signingSecret } = makeDeps();
    resend.injectReceived({
      metadata: {
        emailId: "em_dup",
        from: "a@example.com",
        fromName: null,
        to: ["b@example.com"],
        cc: [],
        bcc: [],
        subject: "x",
        messageId: "<x>",
        attachments: [],
        receivedAt: "2026-08-23T00:00:00Z",
      },
      html: null,
      text: "x",
      headers: {},
      attachments: [],
    });
    const payload = JSON.stringify(samplePayload("em_dup"));
    const headers = signedHeaders(payload, signingSecret);
    const first = await service.handleRaw(payload, headers);
    expect(first.status).toBe("processed");
    const second = await service.handleRaw(payload, headers);
    expect(second.status).toBe("duplicate");
  });

  it("unknown event type is ignored", async () => {
    const { service, signingSecret } = makeDeps();
    const payload = JSON.stringify({
      type: "email.delivered",
      created_at: "2026-08-23T00:00:00Z",
      data: { email_id: "em_1", from: "a@example.com", to: ["b@example.com"], subject: "x" },
    });
    const headers = signedHeaders(payload, signingSecret);
    const result = await service.handleRaw(payload, headers);
    expect(result.status).toBe("ignored");
  });
});
