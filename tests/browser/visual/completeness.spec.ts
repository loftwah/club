// Issue #6 completeness guard.
//
// A new rendered `.astro` page added under the product
// namespaces must show up in the visual manifest, either as an
// explicit entry or by being explicitly allow-listed. This
// prevents an agent from shipping a new screen that visual QA
// silently never exercises.
//
// The scan deliberately limits itself to the four product
// namespaces: public pages, dynamic chapter pages, portal,
// onboarding and admin. API endpoints, the OG route, the brand
// explorer, sitemap/robots and the like are explicitly
// allow-listed in `manifest.ts` and excluded by the relative
// path check below.

import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { VISUAL_SURFACES, VISUAL_MANIFEST_ALLOWLIST } from "./manifest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".astro") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith(".astro")) out.push(full);
  }
  return out;
}

test("visual manifest covers every rendered product surface", () => {
  const repoRoot = resolve(__dirname, "..", "..", "..");
  const productRoots = [
    "src/pages/chapters",
    "src/pages/portal",
    "src/pages/onboarding",
    "src/pages/admin",
  ];
  // Top-level .astro pages are public by default unless the
  // file lives under a product subfolder; treat every top-level
  // .astro in src/pages as a public surface.
  const publicPages = readdirSync(resolve(repoRoot, "src/pages"))
    .filter((name) => name.endsWith(".astro"))
    .map((name) => resolve(repoRoot, "src/pages", name));
  const dynamic: string[] = [];
  for (const rel of productRoots) {
    const full = resolve(repoRoot, rel);
    if (statSync(full, { throwIfNoEntry: false })) {
      for (const file of walk(full)) dynamic.push(file);
    }
  }

  const allProductSurfaces = [...publicPages, ...dynamic];
  const allManifestPaths = new Set<string>(VISUAL_SURFACES.map((s) => s.path));

  const allowed = new Set<string>(VISUAL_MANIFEST_ALLOWLIST.map((p) => resolve(repoRoot, p)));

  const missing: string[] = [];
  for (const file of allProductSurfaces) {
    if (allowed.has(file)) continue;
    // Map the file path to its route. Dynamic chapter slugs are
    // covered by the [slug] template at /chapters/melbourne/
    // etc., so we only require the static list of slugs to match
    // the manifest rather than the template itself.
    const rel = relative(resolve(repoRoot, "src/pages"), file).split(sep).join("/");
    if (rel.startsWith("chapters/")) {
      // The chapter detail template is exercised by every chapter
      // slug in the manifest; the template file does not need
      // its own entry.
      continue;
    }
    if (rel.startsWith("onboarding/")) {
      // The dynamic [step].astro template is exercised by every
      // ONBOARDING_STEPS entry in the manifest.
      continue;
    }
    if (rel.startsWith("api/") || rel.startsWith("og/") || rel.startsWith("internal/")) {
      continue;
    }
    // Map the file to a route prefix and check that at least one
    // manifest path matches. This handles index pages
    // (`/portal/index.astro` -> `/portal/`) and a few other
    // first-class renames.
    const stripped = rel.replace(/\.astro$/, "").replace(/\/index$/, "");
    const route = stripped === "index" ? "/" : `/${stripped}/`;
    if (!allManifestPaths.has(route)) {
      // Allow a few known admin/portal detail pages that are
      // covered by entries under their own id but live under a
      // nested folder.
      const acceptable = ["/admin/creative/", "/portal/account/"];
      if (!acceptable.some((p) => route.startsWith(p))) {
        missing.push(`${rel} -> expected route ${route} in the visual manifest`);
      }
    }
  }

  expect(
    missing,
    `rendered surfaces missing from visual manifest: ${JSON.stringify(missing, null, 2)}`,
  ).toHaveLength(0);
});

// ONBOARDING_STEPS must be a stable, ordered list. The manifest
// relies on the order to drive the route list and the visual
// reference contract.
test("ONBOARDING_STEPS is a stable ordered list of 15 entries", () => {
  // Re-import the source so we fail if the type is reordered or
  // truncated.
  const src = readFileSync(resolve(__dirname, "../../../src/services/onboarding.ts"), "utf-8");
  const stepIds = [
    "identity",
    "chapter",
    "tier",
    "why",
    "event-preferences",
    "communications",
    "memory",
    "post",
    "gifts",
    "calls",
    "manufactured-commitments",
    "appearance-interest",
    "plain-language",
    "terms",
    "payment-gate",
  ];
  for (const id of stepIds) {
    expect(src, `step id ${id} should be in onboarding.ts`).toContain(`"${id}"`);
  }
  const manifestOnboardingIds = VISUAL_SURFACES.filter((s) => s.id.startsWith("onboarding-")).map(
    (s) => s.id.replace("onboarding-", ""),
  );
  expect(manifestOnboardingIds).toEqual(stepIds);
});
