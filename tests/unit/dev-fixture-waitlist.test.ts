import { expect, it } from "vitest";
import { POST } from "../../src/pages/api/internal/dev-fixture/[persona]";

it("the waitlist fixture refuses a production-origin request before accessing local D1", async () => {
  const context = {
    request: new Request("https://club.loftwah.com/api/internal/dev-fixture/waitlist", {
      method: "POST",
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
});
