import { describe, expect, it } from "vitest";
import { renderOgSvg, ogPath } from "../../src/lib/og";

describe("og", () => {
  it("renders a valid SVG for the default template", () => {
    const svg = renderOgSvg();
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain("The Reserved Society".toUpperCase());
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
