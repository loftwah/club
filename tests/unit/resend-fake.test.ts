import { describe, expect, it } from "vitest";
import { FakeResend } from "@adapters/resend-fake";
import type { FakeReceivedEmail } from "@adapters/resend-fake";

describe("fake Resend adapter", () => {
  it("send is idempotent on idempotencyKey", async () => {
    const r = new FakeResend();
    const a = await r.send({
      to: "x@example.com",
      from: "club@loftwah.com",
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
      idempotencyKey: "abc",
    });
    const b = await r.send({
      to: "x@example.com",
      from: "club@loftwah.com",
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
      idempotencyKey: "abc",
    });
    expect(a.providerMessageId).toBe(b.providerMessageId);
    expect(r.sent.length).toBe(1);
  });

  it("failNext forces a failure that the caller can detect", async () => {
    const r = new FakeResend();
    r.failNext("TRANSIENT");
    await expect(
      r.send({
        to: "x@example.com",
        from: "club@loftwah.com",
        subject: "Hi",
        html: "<p>hi</p>",
        text: "hi",
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(/Forced failure: TRANSIENT/);
    // After the forced failure, the next send should succeed.
    await r.send({
      to: "x@example.com",
      from: "club@loftwah.com",
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
      idempotencyKey: "k2",
    });
    expect(r.sent.length).toBe(1);
  });

  it("getReceivedMetadata returns the metadata of an injected email", async () => {
    const r = new FakeResend();
    const email: FakeReceivedEmail = {
      metadata: {
        emailId: "em_1",
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
      html: "<p>hi</p>",
      text: "hi",
      headers: { from: "member@example.com" },
      attachments: [],
    };
    r.injectReceived(email);
    const m = await r.getReceivedMetadata("em_1");
    expect(m.from).toBe("member@example.com");
    const body = await r.getReceivedBody("em_1");
    expect(body.text).toBe("hi");
  });
});
