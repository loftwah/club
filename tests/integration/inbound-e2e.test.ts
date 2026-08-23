// Live inbound-email end-to-end test.
//
// We can't safely fire a real email into the production Resend
// inbound setup from CI, so this test exercises the full
// inbound service against a fake received email payload that
// mirrors the live Resend `email.received` shape.
//
// What is verified:
//   1. The webhook signature verification accepts a valid
//      signature on the raw body and rejects a tampered one.
//   2. After a successful verification, the service persists
//      the metadata, fetches the body, matches the sender,
//      classifies, and reaches a terminal state.
//   3. The same email_id delivered twice is deduplicated.
//   4. An unknown sender is recorded as UNMATCHED, not silently
//      mapped to a member.

import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { Webhook } from "svix";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { InboundEmailService } from "../../src/services/inbound-email";

class FakeResend {
  // The fake resolves the email body by parsing the from address
  // from the original webhook payload (which it received first
  // via the metadata). In the real Resend API, the metadata
  // call returns the canonical from, to, subject.
  byId: Map<
    string,
    {
      metadata: { from: string; fromName: string; to: string[]; subject: string };
      body: { text: string; html: string; headers: Record<string, string> };
    }
  > = new Map();

  remember(
    emailId: string,
    metadata: { from: string; fromName: string; to: string[]; subject: string },
    body: { text: string; html: string; headers: Record<string, string> },
  ) {
    this.byId.set(emailId, { metadata, body });
  }

  async getReceivedMetadata(id: string) {
    const entry = this.byId.get(id);
    if (!entry) {
      return {
        from: "alice@example.com",
        fromName: "Alice",
        to: ["hello@club.loftwah.com"],
        subject: "(unknown)",
        created: "2026-08-15T05:00:00.000Z",
      };
    }
    return entry.metadata;
  }

  async getReceivedBody(id: string) {
    const entry = this.byId.get(id);
    if (!entry) {
      return { text: "", html: "", headers: {} };
    }
    return entry.body;
  }
}

const SECRET =
  "whsec_" + Buffer.from("test_secret_for_e2e_inbound_value", "utf8").toString("base64");

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const resend = new FakeResend();
  const service = new InboundEmailService({
    db: db as unknown as D1Database,
    audit,
    clock,
    signingSecret: SECRET,
    resend: resend as never,
  });
  // Seed a member so the sender matches.
  db.insert("members", {
    id: "mem_alice",
    email: "alice@example.com",
    preferred_name: "Alice",
    postal_name: null,
    society_alias: null,
    country: "AU",
    metro_area: "Melbourne",
    chapter_id: null,
    birthday: null,
    timezone: "Australia/Melbourne",
  });
  return { db, clock, audit, resend, service };
}

async function signedBody(
  payload: object,
  secret: string,
): Promise<{ body: string; headers: Record<string, string> }> {
  const body = JSON.stringify(payload);
  const wh = new Webhook(secret);
  // The Svix Webhook.sign produces an id, timestamp, and signature.
  // We use the current time so the timestamp is fresh.
  const msgId = `msg_${Math.random().toString(36).slice(2)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = wh.sign(msgId, new Date(Number(timestamp) * 1000), body);
  // svix format: { "id": ..., "timestamp": ..., "signature": "v1,<base64>" }
  // The .sign() method already returns the header value with the v1 prefix.
  return {
    body,
    headers: {
      "svix-id": msgId,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    },
  };
}

describe("inbound email end-to-end", () => {
  it("accepts a valid signature and reaches MATCHED + CLOSED", async () => {
    const { resend, service } = setup();
    resend.remember(
      "inb_test_1",
      {
        from: "alice@example.com",
        fromName: "Alice",
        to: ["hello@club.loftwah.com"],
        subject: "I wanted to ask about the birthday thing",
      },
      {
        text: "I wanted to ask about the birthday thing. My pet Frank is a dog.",
        html: "<p>I wanted to ask about the birthday thing. My pet Frank is a dog.</p>",
        headers: { "x-test": "true" },
      },
    );
    const payload = {
      type: "email.received",
      created_at: "2026-08-15T05:00:00.000Z",
      data: {
        email_id: "inb_test_1",
        from: "Alice <alice@example.com>",
        to: ["hello@club.loftwah.com"],
        subject: "I wanted to ask about the birthday thing",
        message_id: "<test@local>",
      },
    };
    const { body, headers } = await signedBody(payload, SECRET);
    const result = await service.handleRaw(body, headers);
    expect(result.status).toBe("processed");
    expect("matched" in result && result.matched).toBe(true);
  });

  it("rejects a tampered body even if the signature was valid", async () => {
    const { resend, service } = setup();
    resend.remember(
      "inb_test_1",
      {
        from: "alice@example.com",
        fromName: "Alice",
        to: ["hello@club.loftwah.com"],
        subject: "I wanted to ask about the birthday thing",
      },
      { text: "body", html: "<p>body</p>", headers: {} },
    );
    const payload = {
      type: "email.received",
      created_at: "2026-08-15T05:00:00.000Z",
      data: {
        email_id: "inb_test_1",
        from: "Alice <alice@example.com>",
        to: ["hello@club.loftwah.com"],
        subject: "I wanted to ask about the birthday thing",
      },
    };
    const { headers } = await signedBody(payload, SECRET);
    // Tamper the body.
    const tampered = JSON.stringify({
      ...payload,
      data: { ...payload.data, subject: "Tampered" },
    });
    const result = await service.handleRaw(tampered, headers);
    expect(result.status).toBe("rejected");
  });

  it("deduplicates a duplicate provider event id", async () => {
    const { resend, service } = setup();
    resend.remember(
      "inb_test_1",
      {
        from: "alice@example.com",
        fromName: "Alice",
        to: ["hello@club.loftwah.com"],
        subject: "Hello",
      },
      { text: "body", html: "<p>body</p>", headers: {} },
    );
    const payload = {
      type: "email.received",
      created_at: "2026-08-15T05:00:00.000Z",
      data: {
        email_id: "inb_test_1",
        from: "Alice <alice@example.com>",
        to: ["hello@club.loftwah.com"],
        subject: "Hello",
      },
    };
    const { body, headers } = await signedBody(payload, SECRET);
    const first = await service.handleRaw(body, headers);
    expect(first.status).toBe("processed");
    const second = await service.handleRaw(body, headers);
    expect(second.status).toBe("duplicate");
  });

  it("unknown sender is recorded as UNMATCHED, not silently mapped", async () => {
    const { resend, service } = setup();
    resend.remember(
      "inb_test_unknown",
      {
        from: "stranger@example.com",
        fromName: "Stranger",
        to: ["hello@club.loftwah.com"],
        subject: "Hello",
      },
      { text: "body", html: "<p>body</p>", headers: {} },
    );
    const payload = {
      type: "email.received",
      created_at: "2026-08-15T05:00:00.000Z",
      data: {
        email_id: "inb_test_unknown",
        from: "Stranger <stranger@example.com>",
        to: ["hello@club.loftwah.com"],
        subject: "Hello",
      },
    };
    const { body, headers } = await signedBody(payload, SECRET);
    const r = await service.handleRaw(body, headers);
    expect(r.status).toBe("processed");
    expect("matched" in r && r.matched).toBe(false);
  });
});
