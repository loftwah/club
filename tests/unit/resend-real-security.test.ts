import { describe, expect, it, vi } from "vitest";
import { RealResendAdapter } from "../../src/adapters/resend-real";

function metadata(downloadUrl: string) {
  return new Response(
    JSON.stringify({
      id: "email_1",
      attachments: [{ id: "attachment_1", download_url: downloadUrl }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("RealResendAdapter attachment boundary", () => {
  it("rejects a provider-supplied cross-origin attachment URL", async () => {
    const fetchImpl = vi.fn(async () => metadata("https://169.254.169.254/latest/meta-data"));
    const adapter = new RealResendAdapter({ apiKey: "re_test", fetchImpl });

    await expect(
      adapter.getReceivedAttachment({ emailId: "email_1", attachmentId: "attachment_1" }),
    ).rejects.toThrow("origin is not allowlisted");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetches a same-origin attachment without following redirects", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(metadata("https://api.resend.com/attachments/attachment_1"))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-length": "3" },
        }),
      );
    const adapter = new RealResendAdapter({ apiKey: "re_test", fetchImpl });

    const result = await adapter.getReceivedAttachment({
      emailId: "email_1",
      attachmentId: "attachment_1",
    });

    expect([...result.bytes]).toEqual([1, 2, 3]);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      new URL("https://api.resend.com/attachments/attachment_1"),
      expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }),
    );
  });
});
