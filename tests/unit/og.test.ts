import { describe, expect, it } from "vitest";
import { renderOgSvg, ogPath } from "../../src/lib/og";

describe("og", () => {
  it("renders a valid SVG for the default template", () => {
    const svg = renderOgSvg();
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain("Plans With You".toUpperCase());
  });

  it("renders each template", () => {
    for (const t of ["default", "membership", "how-it-works", "chapter", "journal"] as const) {
      const svg = renderOgSvg({ template: t });
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(1000);
    }
  });

  it("escapes XML special characters in the title", () => {
    const svg = renderOgSvg({ title: "Tom & Jerry < Friends" });
    expect(svg).toContain("Tom &amp; Jerry &lt; Friends");
    expect(svg).not.toContain("Tom & Jerry < Friends>");
  });

  it("produces a query string for non-default templates", () => {
    expect(ogPath("default")).toBe("/og/default.svg");
    expect(ogPath("membership")).toContain("t=membership");
    expect(ogPath("chapter", { chapter: "Melbourne" })).toContain("chapter=Melbourne");
  });
});

it("refuses an altered native illustration or substituted raster", async () => {
  const { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } =
    await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { spawnSync } = await import("node:child_process");
  const receiptFile = "public/og/cancelled-20261025-provenance.json";
  const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
  const temporary = mkdtempSync(join(tmpdir(), "pwy-og-provenance-"));
  try {
    for (const file of [
      receiptFile,
      ...Object.keys(receipt.sources),
      ...receipt.outputs.map((out: { file: string }) => "public/og/" + out.file),
    ]) {
      mkdirSync(dirname(join(temporary, file)), { recursive: true });
      copyFileSync(file, join(temporary, file));
    }
    const check = () =>
      spawnSync(process.execPath, ["scripts/og-generate.mjs", "--check"], {
        cwd: temporary,
        encoding: "utf8",
      });
    expect(check().status).toBe(0);
    const master = "creative/og-20261025/master.png";
    writeFileSync(join(temporary, master), "substituted illustration");
    expect(check().status).not.toBe(0);
    copyFileSync(master, join(temporary, master));
    const raster = join(temporary, "public/og/cancelled-20261025.jpg");
    const bytes = readFileSync(raster);
    bytes[bytes.length - 1] ^= 1;
    writeFileSync(raster, bytes);
    expect(check().status).not.toBe(0);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
