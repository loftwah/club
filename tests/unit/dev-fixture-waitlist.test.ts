import { expect, it } from "vitest";
import { POST } from "../../src/pages/api/internal/dev-fixture/[persona]";

const deniedRequests: Array<[string, HeadersInit]> = [
  ["without a local peer", {}],
  [
    "with a forged forwarded hop",
    { "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "127.0.0.1" },
  ],
];

it.each(deniedRequests)(
  "the waitlist fixture refuses production %s before accessing D1",
  async (_label, headers) => {
    const context = {
      request: new Request("https://club.loftwah.com/api/internal/dev-fixture/waitlist", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "fixture@example.test" }),
      }),
      params: { persona: "waitlist" },
      get locals() {
        throw new Error("A refused production request must never reach D1");
      },
    } as unknown as Parameters<typeof POST>[0];
    const response = await POST(context);
    if (!(response instanceof Response)) throw new Error("Expected an explicit refusal response");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "dev-fixture endpoints are loopback-only" });
  },
);
