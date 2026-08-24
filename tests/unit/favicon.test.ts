import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path);
const readText = (path: string) => readFileSync(path, "utf8");

describe("site icons", () => {
  it("links the complete icon set from the shared document head", () => {
    const layout = readText("src/layouts/Base.astro");

    expect(layout).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(layout).toContain('<link rel="icon" href="/favicon.ico" sizes="32x32" />');
    expect(layout).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(layout).toContain('<link rel="manifest" href="/site.webmanifest" />');
  });

  it("ships a visible SVG mark rather than an empty placeholder", () => {
    const favicon = readText("public/favicon.svg");

    expect(favicon).toContain('viewBox="0 0 64 64"');
    expect(favicon).toContain("#1932BE");
    expect(favicon).toContain("#E94616");
    expect(favicon.length).toBeGreaterThan(500);
  });

  it("ships conventional browser, Apple and installable-app icon files", () => {
    const ico = read("public/favicon.ico");
    const apple = read("public/apple-touch-icon.png");
    const app192 = read("public/icon-192.png");
    const app512 = read("public/icon-512.png");
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(ico.subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));
    expect(apple.subarray(0, 8)).toEqual(pngSignature);
    expect(app192.subarray(0, 8)).toEqual(pngSignature);
    expect(app512.subarray(0, 8)).toEqual(pngSignature);
    expect(statSync("public/favicon.ico").size).toBeGreaterThan(500);
  });

  it("declares the installable-app icons and locked brand colours", () => {
    const manifest = JSON.parse(readText("public/site.webmanifest"));

    expect(manifest.name).toBe("Plans With You");
    expect(manifest.theme_color).toBe("#F5F1E7");
    expect(manifest.background_color).toBe("#F5F1E7");
    expect(manifest.icons).toEqual([
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ]);
  });
});
