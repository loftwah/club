import type { D1Database } from "@cloudflare/workers-types";
import { describe, expect, it, vi } from "vitest";
import { readCancellationCounter } from "../../src/lib/counter";

function counterDatabase(result: { n: number } | Error): D1Database {
  const first =
    result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  return {
    prepare: vi.fn(() => ({ first })),
  } as unknown as D1Database;
}

describe("public cancellation counter", () => {
  it("reports a confirmed zero as available", async () => {
    await expect(readCancellationCounter(counterDatabase({ n: 0 }))).resolves.toEqual({
      status: "available",
      cancelledEvents: 0,
    });
  });

  it("does not turn a missing database into zero", async () => {
    await expect(readCancellationCounter(undefined)).resolves.toEqual({
      status: "unavailable",
      cancelledEvents: null,
    });
  });

  it("does not turn a failed count query into zero", async () => {
    const error = new Error("query failed");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(readCancellationCounter(counterDatabase(error))).resolves.toEqual({
      status: "unavailable",
      cancelledEvents: null,
    });
    expect(log).toHaveBeenCalledWith("public cancellation counter unavailable", error);
    log.mockRestore();
  });
});
