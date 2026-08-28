import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = "/tmp/prod-screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const targets = [
  { name: "home-desktop", path: "/", w: 1440, h: 1000 },
  { name: "home-mobile", path: "/", w: 390, h: 844 },
  { name: "home-tablet-768", path: "/", w: 768, h: 1024 },
  { name: "home-minimum-320", path: "/", w: 320, h: 568 },
  { name: "how-it-works-desktop", path: "/how-it-works/", w: 1440, h: 1000 },
  { name: "how-it-works-mobile", path: "/how-it-works/", w: 390, h: 844 },
  { name: "how-it-works-tablet-768", path: "/how-it-works/", w: 768, h: 1024 },
  { name: "membership-desktop", path: "/membership/", w: 1440, h: 1000 },
  { name: "membership-mobile", path: "/membership/", w: 390, h: 844 },
  { name: "chapters-desktop", path: "/chapters/", w: 1440, h: 1000 },
  { name: "chapters-mobile", path: "/chapters/", w: 390, h: 844 },
  { name: "correspondence-desktop", path: "/correspondence/", w: 1440, h: 1000 },
  { name: "correspondence-mobile", path: "/correspondence/", w: 390, h: 844 },
  { name: "faq-desktop", path: "/faq/", w: 1440, h: 1000 },
  { name: "faq-mobile", path: "/faq/", w: 390, h: 844 },
  { name: "chapters-melbourne-desktop", path: "/chapters/melbourne/", w: 1440, h: 1000 },
  { name: "chapters-melbourne-mobile", path: "/chapters/melbourne/", w: 390, h: 844 },
  { name: "waiting-list-desktop", path: "/waiting-list/", w: 1440, h: 1000 },
  { name: "waiting-list-mobile", path: "/waiting-list/", w: 390, h: 844 },
  { name: "journal-desktop", path: "/journal/", w: 1440, h: 1000 },
  { name: "journal-mobile", path: "/journal/", w: 390, h: 844 },
  { name: "privacy-desktop", path: "/privacy/", w: 1440, h: 1000 },
  { name: "terms-desktop", path: "/terms/", w: 1440, h: 1000 },
];

const results = [];
for (const t of targets) {
  const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h } });
  const page = await ctx.newPage();
  const start = Date.now();
  const resp = await page.goto(`https://club.loftwah.com${t.path}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  const status = resp?.status();
  const title = await page.title();
  const measurements = await page.evaluate(() => {
    const shell = document.querySelector(".pwy-shell");
    const h1 = document.querySelector("h1");
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const result = {
      overflow,
      h1: null,
      shellWidth: null,
      heroColumns: null,
    };
    if (h1) {
      const cs = getComputedStyle(h1);
      const fs = parseFloat(cs.fontSize);
      result.h1 = {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontSizePx: fs,
        capOk: fs <= 93,
      };
    }
    if (shell) {
      const r = shell.getBoundingClientRect();
      result.shellWidth = r.width;
    }
    const heroGrid = document.querySelector(".pwy-hero__grid");
    if (heroGrid) {
      const cols = getComputedStyle(heroGrid).gridTemplateColumns.split(" ").filter(Boolean).length;
      result.heroColumns = cols;
    }
    return result;
  });
  const buf = await page.screenshot({ fullPage: false });
  writeFileSync(join(outDir, `${t.name}.png`), buf);
  results.push({
    name: t.name,
    path: t.path,
    viewport: `${t.w}x${t.h}`,
    status,
    title,
    overflow: measurements.overflow,
    shellWidth: measurements.shellWidth,
    heroColumns: measurements.heroColumns,
    h1Family: measurements.h1?.fontFamily ?? null,
    h1Size: measurements.h1?.fontSize ?? null,
    h1CapOk: measurements.h1?.capOk ?? null,
    dt: Date.now() - start,
  });
  await ctx.close();
}
await browser.close();

let failed = 0;
for (const r of results) {
  const ok = r.status === 200 && r.overflow <= 1 && (r.h1Size == null || r.h1CapOk);
  if (!ok) failed++;
  console.info(
    `${ok ? "OK  " : "FAIL"}  ${r.name.padEnd(32)}  ${r.viewport.padEnd(11)}  ` +
      `status=${r.status}  overflow=${r.overflow}  ` +
      `shell=${r.shellWidth?.toFixed(0) ?? "-"}  heroCols=${r.heroColumns ?? "-"}  ` +
      `h1=${r.h1Size ?? "-"}${r.h1CapOk === false ? " !OVER" : ""}  dt=${r.dt}ms`,
  );
}
console.info(`\n${results.length - failed}/${results.length} viewports passed`);
process.exit(failed > 0 ? 1 : 0);
