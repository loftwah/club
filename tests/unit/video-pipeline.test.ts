import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { canonical, selectedCanonical } from "../../scripts/video/shared.mjs";
import { parseByteRange } from "../../src/pages/admin/creative/assets/[id]/[kind]";

describe("commercial video pipeline guards", () => {
  it("keeps every poster and storyboard frame inside its composition", () => {
    for (const item of canonical) {
      for (const frame of [item.posterFrame, ...item.storyboardFrames]) {
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(item.durationInFrames);
      }
    }
  });

  it("rejects unknown canonical selections", () => {
    expect(() => selectedCanonical(["unknown-campaign"])).toThrow(/Unknown canonical composition/);
  });

  it("does not accept a generic documentation file as art-direction approval", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/video/approve.mjs", "--all", "--review=docs/VIDEO_ACCEPTANCE.md"],
      { encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Decision: APPROVED");
  });
});

describe("creative-library byte ranges", () => {
  it("accepts one bounded, open-ended, or suffix byte range", () => {
    expect(parseByteRange("bytes=10-19")).toEqual({ offset: 10, length: 10 });
    expect(parseByteRange("bytes=10-")).toEqual({ offset: 10 });
    expect(parseByteRange("bytes=-128")).toEqual({ suffix: 128 });
  });

  it("rejects malformed, multiple, backwards, and unsafe ranges", () => {
    for (const value of ["bytes=", "bytes=20-10", "bytes=0-1,4-5", "items=0-2", "bytes=-0"])
      expect(parseByteRange(value)).toBe("invalid");
  });
});
