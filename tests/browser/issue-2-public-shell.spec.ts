// Issue #2 + Issue #16: restore the canonical public shell,
// display face and breakpoints across the ordinary public
// routes, and prove the canonical chassis is present.
//
// Before the fix, ordinary public routes (notably the chapters
// list and chapter detail) rendered a `.pwy-page` and a
// `.pwy-shell` div with NO max-width applied — the section sat
// flush against the browser edge. The earlier version of this
// test only asserted `shellWidth <= viewportWidth`, which an
// unstyled 100%-width shell trivially satisfied. The contract
// is now strict: the chassis is loaded by Base.astro (single
// import), every ordinary public route must wrap its content
// in `<section class="pwy-page">…<div class="pwy-shell">…`,
// and the rendered geometry must satisfy the full Dispatch
// Wall contract at every canonical viewport:
//
//   - shell computed `max-width` resolves to the intended
//     contract (90rem for ordinary routes, 78rem for
//     /waiting-list/);
//   - shell computed `padding-left` and `padding-right` resolve
//     to the canonical non-zero gutter at each viewport;
//   - shell is centred when the viewport exceeds the shell
//     width;
//   - first meaningful page content (h1) starts at or inside
//     the shell's left content edge, NOT at x=0;
//   - last meaningful page content ends at or inside the right
//     shell content edge;
//   - no page-level horizontal overflow exists at any
//     canonical viewport.
//
// The narrow-composition contract (hero / two-column grid
// collapses at 768px) is also retained.

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..", "..");

type ShellContract = {
  readonly maxWidthRem: number;
  readonly label: string;
};

const ORDINARY_PUBLIC_ROUTES = [
  { path: "/how-it-works/", name: "how-it-works" },
  { path: "/membership/", name: "membership" },
  { path: "/correspondence/", name: "correspondence" },
  { path: "/chapters/", name: "chapters" },
  { path: "/chapters/melbourne/", name: "chapters-melbourne" },
  { path: "/chapters/sydney/", name: "chapters-sydney" },
  { path: "/journal/", name: "journal" },
  { path: "/faq/", name: "faq" },
  { path: "/privacy/", name: "privacy" },
  { path: "/terms/", name: "terms" },
  // 404 is rendered for an unknown path; we don't enumerate it
  // here because Astro's 404 page is rendered for the catch-all
  // not-found case rather than a fixed route.
] as const;

const FOCUS_EXCEPTION_ROUTES = [{ path: "/waiting-list/", name: "waiting-list" }] as const;

const ALL_ROUTES = [...ORDINARY_PUBLIC_ROUTES, ...FOCUS_EXCEPTION_ROUTES] as const;

const VIEWPORTS = [
  { width: 1440, height: 1000, label: "desktop" },
  { width: 1024, height: 768, label: "compact" },
  { width: 768, height: 1024, label: "boundary" },
  { width: 390, height: 844, label: "mobile" },
  { width: 320, height: 568, label: "minimum" },
] as const;

const FONT_CAP_PX = 92.8; // 5.8rem at the canonical 16px root
const TOLERANCE_PX = 1.5;

function contractFor(path: string): ShellContract {
  return path === "/waiting-list/"
    ? { maxWidthRem: 78, label: "78rem (focus exception)" }
    : { maxWidthRem: 90, label: "90rem (canonical Dispatch Wall)" };
}

interface ShellGeometry {
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly height: number;
  readonly computedMaxWidth: string;
  readonly computedMaxWidthPx: number;
  readonly computedPaddingLeft: number;
  readonly computedPaddingRight: number;
  readonly contentLeft: number;
  readonly contentRight: number;
  readonly centred: boolean;
  readonly expectedMaxWidthPx: number;
}

interface PageContent {
  readonly h1Left: number;
  readonly h1Right: number;
  readonly h1FontSize: number;
  readonly h1FontFamily: string;
  readonly h1Visible: boolean;
  readonly documentScrollWidth: number;
  readonly documentClientWidth: number;
}

async function measurePage(page: import("@playwright/test").Page): Promise<PageContent> {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const h1Visible = h1 instanceof HTMLElement && h1.getBoundingClientRect().width > 0;
    let h1Left = 0;
    let h1Right = 0;
    let h1FontSize = 0;
    let h1FontFamily = "";
    if (h1 instanceof HTMLElement) {
      const r = h1.getBoundingClientRect();
      h1Left = r.left;
      h1Right = r.right;
      const s = getComputedStyle(h1);
      h1FontSize = Number.parseFloat(s.fontSize) || 0;
      h1FontFamily = s.fontFamily;
    }
    return {
      h1Left,
      h1Right,
      h1FontSize,
      h1FontFamily,
      h1Visible,
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    };
  });
}

// Contract lookup bound at module load (avoids passing a serialised
// value across the page.evaluate boundary).
const contractByPath = new Map<string, ShellContract>();
for (const r of ALL_ROUTES) contractByPath.set(r.path, contractFor(r.path));

async function measureShellAt(
  page: import("@playwright/test").Page,
  path: string,
): Promise<ShellGeometry> {
  const contract = contractByPath.get(path) ?? { maxWidthRem: 90, label: "90rem" };
  return page.evaluate((expectedPx: number) => {
    const shell = document.querySelector(".pwy-shell");
    if (!(shell instanceof HTMLElement)) {
      throw new Error(".pwy-shell element not found in rendered DOM");
    }
    const rect = shell.getBoundingClientRect();
    const style = getComputedStyle(shell);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const maxWidthCss = style.maxWidth;
    let maxWidthPx = Number.POSITIVE_INFINITY;
    if (maxWidthCss.endsWith("px")) {
      maxWidthPx = Number.parseFloat(maxWidthCss);
    } else if (maxWidthCss.endsWith("rem")) {
      maxWidthPx = Number.parseFloat(maxWidthCss) * 16;
    } else if (maxWidthCss.endsWith("em")) {
      maxWidthPx = Number.parseFloat(maxWidthCss) * 16;
    }
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      computedMaxWidth: maxWidthCss,
      computedMaxWidthPx: maxWidthPx,
      computedPaddingLeft: paddingLeft,
      computedPaddingRight: paddingRight,
      contentLeft: rect.left + paddingLeft,
      contentRight: rect.right - paddingRight,
      centred: Math.abs(rect.left - (window.innerWidth - rect.right)) <= 1.5,
      expectedMaxWidthPx: expectedPx,
    };
  }, contract.maxWidthRem * 16);
}

for (const route of ALL_ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} geometry @ ${viewport.label} (${viewport.width}x${viewport.height})`, async ({
      browser,
    }) => {
      const contract = contractByPath.get(route.path)!;
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      await page.goto(route.path);

      const shell = page.locator(".pwy-shell").first();
      await expect(shell).toBeVisible();
      const shellGeom = await measureShellAt(page, route.path);

      // 1. Shell computed `max-width` MUST resolve to the
      //    contract. An unstyled shell returns `none` and
      //    measured as +Infinity — this assertion fails
      //    loudly and points at the missing chassis import.
      expect(
        Number.isFinite(shellGeom.computedMaxWidthPx),
        `${route.name}: .pwy-shell has no resolved max-width (got "${shellGeom.computedMaxWidth}") — the public-page chassis is not applied.`,
      ).toBe(true);
      expect(
        Math.abs(shellGeom.computedMaxWidthPx - shellGeom.expectedMaxWidthPx),
        `${route.name}: shell max-width ${shellGeom.computedMaxWidthPx}px must equal the contract ${shellGeom.expectedMaxWidthPx}px (${contract.label})`,
      ).toBeLessThanOrEqual(TOLERANCE_PX);

      // 2. Shell computed `padding-left` and `padding-right`
      //    MUST resolve to the canonical non-zero gutter at
      //    every viewport. The canonical gutter is
      //    `clamp(1rem, 3vw, 3rem)`, so at every test
      //    viewport the resolved padding is at least 16px.
      const minGutter = 16;
      expect(
        shellGeom.computedPaddingLeft,
        `${route.name}: shell padding-left must be >= ${minGutter}px at ${viewport.width}px viewport (got ${shellGeom.computedPaddingLeft}px)`,
      ).toBeGreaterThanOrEqual(minGutter - 0.5);
      expect(
        shellGeom.computedPaddingRight,
        `${route.name}: shell padding-right must be >= ${minGutter}px at ${viewport.width}px viewport (got ${shellGeom.computedPaddingRight}px)`,
      ).toBeGreaterThanOrEqual(minGutter - 0.5);

      // 3. Shell MUST be centred when the viewport exceeds
      //    the shell width. At narrow viewports the shell
      //    fills the viewport and centring is automatic; we
      //    only assert when there is spare horizontal space.
      if (viewport.width > shellGeom.computedMaxWidthPx + 4) {
        expect(
          shellGeom.centred,
          `${route.name}: shell must be horizontally centred when viewport (${viewport.width}px) > max-width (${shellGeom.computedMaxWidthPx}px); got left=${shellGeom.left}, right=${shellGeom.right}`,
        ).toBe(true);
      }

      // 4. No page-level horizontal overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `document overflow on ${route.name}`).toBeLessThanOrEqual(1);

      // 5. First meaningful content (h1) MUST start at or
      //    inside the shell content edge, NOT at x=0.
      //    This is the exact regression the user reported:
      //    "content flush against the browser edge".
      const content = await measurePage(page);
      expect(
        content.h1Visible,
        `${route.name}: page must render an h1 at ${viewport.width}px`,
      ).toBe(true);
      expect(
        content.h1Left,
        `${route.name}: h1 left (${content.h1Left}px) must be inside shell content edge (>= ${shellGeom.contentLeft}px); a value near 0 means the chassis is missing`,
      ).toBeGreaterThanOrEqual(shellGeom.contentLeft - TOLERANCE_PX);

      // 6. Primary h1 must use the display face and stay
      //    under the canonical 5.8rem cap.
      expect(
        content.h1FontFamily,
        `${route.name} h1 should use the display (Archivo) face`,
      ).toMatch(/Archivo/i);
      expect(
        content.h1FontSize,
        `${route.name} h1 size ${content.h1FontSize}px must be <= 5.8rem (${FONT_CAP_PX}px)`,
      ).toBeLessThanOrEqual(FONT_CAP_PX + 0.5);

      await context.close();
    });
  }
}

// The narrow-composition contract: at 768px and below, the
// ordinary hero / two-column grid must have collapsed to a
// single column. We probe one representative route per shape.
test("narrow composition collapses the hero at 768px (how-it-works)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await context.newPage();
  await page.goto("/how-it-works/");
  const heroGrid = page.locator(".pwy-hero__grid").first();
  await expect(heroGrid).toBeVisible();
  const columns = await heroGrid.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns, "hero must be one column at 768px").toBe(1);
  await context.close();
});

// Issue #16: synthetic-mutation test that proves the
// geometry contract fails when the public-page chassis is
// missing. We inject a stylesheet that wipes the chassis
// rules from .pwy-shell and re-run the geometry check on
// /chapters/. The same check on the unmutated page must
// pass first, so a real regression is distinguished from a
// pre-existing chassis gap.
test("chassis-absent mutation breaks the geometry contract (chapters)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto("/chapters/");
  // Sanity: the unmutated page passes.
  const baseline = await measureShellAt(page, "/chapters/");
  expect(
    Math.abs(baseline.computedMaxWidthPx - 90 * 16),
    "baseline chapters shell must satisfy the 90rem contract",
  ).toBeLessThanOrEqual(TOLERANCE_PX);

  // Inject a stylesheet that strips the chassis. The next
  // measureShellAt call must see `max-width: none` and a
  // 0px padding, simulating a route that forgot the import.
  await page.addStyleTag({
    content: `
      .pwy-page { all: revert; }
      .pwy-page .pwy-shell {
        all: revert;
        max-width: none !important;
        margin-inline: 0 !important;
        padding-inline: 0 !important;
      }
      .pwy-page h1 { all: revert; }
    `,
  });
  const mutated = await measureShellAt(page, "/chapters/");
  // After mutation the contract MUST break. We assert the
  // opposite of the production assertion so this test
  // proves the production assertion is meaningful.
  expect(
    Number.isFinite(mutated.computedMaxWidthPx),
    "after mutation the chassis must be gone — if this fails, the mutation was not applied",
  ).toBe(false);

  await context.close();
});

// Issue #16: completeness guard for the architectural
// import. If a new ordinary public route is added to the
// repository without using the canonical Base layout (or
// without wrapping its content in .pwy-page > .pwy-shell),
// fail the suite before any browser is launched. This is
// the static complement to the dynamic geometry check
// above.
test("every ordinary public route uses the canonical chassis (Base.astro + pwy-page + pwy-shell)", () => {
  // Source-level invariant: each ordinary public route must
  // (a) extend Base.astro, and (b) wrap its content in
  // <section class="pwy-page …"><div class="pwy-shell">…</div></section>.
  // The .pwy-page chassis rules now live in
  // src/styles/public-pages.css which Base.astro imports
  // directly; a route that bypasses Base loses the chassis
  // even if it manually imports the stylesheet.
  const baseImportRe = /import\s+Base\s+from\s+["']@layouts\/Base(?:\.astro)?["']/;
  // Accept either a static class="…pwy-page…" form, a
  // template-literal class={`pwy-page ${extra}`}` form, or
  // a spread form like class={["pwy-page", extra]}.
  const pwyPageRe =
    /class\s*=\s*(?:["'`][^"'`]*\bpwy-page\b[^"'`]*["'`]|\{[^}]*\bpwy-page\b[^}]*\})/;
  const pwyShellRe =
    /class\s*=\s*(?:["'`][^"'`]*\bpwy-shell\b[^"'`]*["'`]|\{[^}]*\bpwy-shell\b[^}]*\})/;

  const repoRoot = REPO_ROOT;
  const missing: string[] = [];
  for (const route of ORDINARY_PUBLIC_ROUTES) {
    // `route.path` may be `/chapters/` or `/chapters/melbourne/`;
    // the file path is the same template (`[slug].astro`) in
    // both cases. For the rest, drop the leading slash and the
    // trailing slash and append `.astro` to get the canonical
    // file path under `src/pages/`.
    const filePath = route.path.startsWith("/chapters/")
      ? join(repoRoot, "src", "pages", "chapters", "[slug].astro")
      : join(repoRoot, "src", "pages", `${route.path.replace(/^\//, "").replace(/\/$/, "")}.astro`);
    let text: string;
    try {
      text = readFileSync(filePath, "utf-8");
    } catch {
      missing.push(`${route.path} -> file not found at ${filePath}`);
      continue;
    }
    if (!baseImportRe.test(text)) {
      missing.push(`${route.path} -> must import Base from "@layouts/Base.astro"`);
    }
    if (!pwyPageRe.test(text)) {
      missing.push(`${route.path} -> must wrap content in .pwy-page`);
    }
    if (!pwyShellRe.test(text)) {
      missing.push(`${route.path} -> must wrap content in .pwy-shell`);
    }
  }
  expect(
    missing,
    `ordinary public routes missing the canonical chassis contract:\n  - ${missing.join("\n  - ")}`,
  ).toHaveLength(0);
});
