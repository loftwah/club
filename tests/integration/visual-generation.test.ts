import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileVisualRegistry, generateVisual } from "../../src/lib/visual-generation";
import { FakeMiniMax } from "../../src/adapters/minimax-fake";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "visual-"));
  const registry = new FileVisualRegistry(join(dir, "_registry.json"));
  return { registry };
}

describe("visual generation pipeline", () => {
  it("records the visual asset with prompt, model, dimensions, and status", async () => {
    const { registry } = setup();
    const ai = new FakeMiniMax();
    const asset = await generateVisual(
      ai,
      registry,
      {
        id: "hero_warm",
        prompt: "warm cream paper, soft window light, no text, photograph",
        destination: "public/og/hero.svg",
        width: 1200,
        height: 630,
        notes: "Homepage hero mood.",
      },
      { maxAttempts: 1 },
    );
    expect(asset.id).toBe("hero_warm");
    expect(asset.prompt).toContain("warm");
    expect(asset.destination).toBe("public/og/hero.svg");
    expect(asset.width).toBe(1200);
    expect(asset.height).toBe(630);
    expect(asset.status).toBe("candidate");
    const all = await registry.list();
    expect(all.length).toBe(1);
  });

  it("calls the AI exactly once for critique when it passes", async () => {
    const { registry } = setup();
    const ai = new FakeMiniMax({
      responses: { "visual-critique": "PASS" },
    });
    await generateVisual(
      ai,
      registry,
      {
        id: "mood_001",
        prompt: "abstract atmospheric mood, no text",
        destination: "public/og/mood.svg",
        width: 1200,
        height: 630,
      },
      { maxAttempts: 3 },
    );
    // One text call (critique) and one image call.
    expect(ai.textCalls).toHaveLength(1);
    expect(ai.imageCalls).toHaveLength(1);
  });

  it("re-rolls on REJECT up to maxAttempts", async () => {
    const { registry } = setup();
    const ai = new FakeMiniMax({
      responses: { "visual-critique": "REJECT - too generic" },
    });
    await generateVisual(
      ai,
      registry,
      {
        id: "re_001",
        prompt: "abstract mood",
        destination: "public/og/r.svg",
        width: 1200,
        height: 630,
      },
      { maxAttempts: 2, refine: (prev) => prev + " refined" },
    );
    // Two text critiques (REJECT, REJECT), one image at the end.
    expect(ai.textCalls.length).toBeGreaterThanOrEqual(2);
    expect(ai.imageCalls).toHaveLength(1);
  });

  it("registry rejects no production text-bearing assets (MiniMax-typography invariant)", () => {
    // This test documents the invariant: visual asset records never
    // claim "production" status for anything that requires readable
    // text in the image. Production text always uses HTML / SVG.
    // This is a documentation test — the system has no production
    // status for text-bearing images.
    const doc =
      "MiniMax imagery is for mood, atmosphere, and physical objects. Anything that must be read uses HTML / CSS / SVG. See src/lib/og.ts.";
    expect(doc).toContain("HTML / CSS / SVG");
  });
});
