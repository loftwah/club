import { describe, expect, it } from "vitest";
import { InMemoryIdempotencyStore } from "@infra/idempotency";

describe("in-memory idempotency store", () => {
  it("first claim succeeds; second claim on the same key is a duplicate", async () => {
    const store = new InMemoryIdempotencyStore();
    const first = await store.claim({ key: "k1", scope: "scope", jobId: "j1" });
    expect(first.status).toBe("claimed");
    await store.record({ key: "k1", scope: "scope", jobId: "j1", result: { x: 1 } });
    const second = await store.claim({ key: "k1", scope: "scope", jobId: "j2" });
    expect(second.status).toBe("duplicate");
    if (second.status === "duplicate") {
      expect(second.record.result).toEqual({ x: 1 });
    }
  });

  it("different keys in the same scope are independent", async () => {
    const store = new InMemoryIdempotencyStore();
    const a = await store.claim({ key: "a", scope: "scope", jobId: "j1" });
    const b = await store.claim({ key: "b", scope: "scope", jobId: "j1" });
    expect(a.status).toBe("claimed");
    expect(b.status).toBe("claimed");
  });

  it("release allows the key to be claimed again", async () => {
    const store = new InMemoryIdempotencyStore();
    await store.claim({ key: "k", scope: "scope", jobId: "j1" });
    await store.release({ key: "k", scope: "scope" });
    const second = await store.claim({ key: "k", scope: "scope", jobId: "j1" });
    expect(second.status).toBe("claimed");
  });
});
