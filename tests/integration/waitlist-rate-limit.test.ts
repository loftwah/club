import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { POST as waitlistPost, waitlistRateLimitKeys } from "../../src/pages/api/waitlist";
import { MockD1Database } from "../support/mock-d1";

describe("waitlist abuse boundary", () => {
  it("keeps one client key across unique emails while separating email keys", async () => {
    const request = new Request("https://club.loftwah.com/api/waitlist", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.7" },
    });
    const first = await waitlistRateLimitKeys(request, "one@example.com");
    const second = await waitlistRateLimitKeys(request, "two@example.com");

    expect(first[0]).toBe(second[0]);
    expect(first[1]).not.toBe(second[1]);
    expect(first[0]).not.toContain("203.0.113.7");
    expect(first[1]).not.toContain("one@example.com");
  });

  it("rejects when the per-client limit is exhausted even for a valid new email", async () => {
    const keys: string[] = [];
    const limiter = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: keys.length !== 1 };
      },
    };
    const request = new Request("https://club.loftwah.com/api/waitlist", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://club.loftwah.com",
        "cf-connecting-ip": "203.0.113.7",
      },
      body: JSON.stringify({ email: "fresh@example.com" }),
    });
    const response = await waitlistPost({
      request,
      locals: {
        __testRuntimeEnv: {
          DB: new MockD1Database() as unknown as D1Database,
          RESEND_API_KEY: "configured",
          RESEND_WEBHOOK_SIGNING_SECRET: "configured",
          WAITLIST_RATE_LIMITER: limiter,
        },
      },
    } as never);

    expect(response.status).toBe(429);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });
});
