# ThreeUI production-candidate bakeoff

Status: internal research only. No public production route imports ThreeUI.

## Scope

`/internal/threeui-bakeoff/` compares three product-specific visual candidates
against semantic HTML/CSS baselines:

1. membership card / invitation — `EngravedCertificate`
2. envelope / correspondence — `WovenCloth`
3. cancellation counter / plan stack — `StructureFlowCollection` with the
   `data-field` variant

The heavier `BookshelfScene` was also inspected as a correspondence archive
candidate but is measured as a reject below.

The comparison is intentionally bounded. The left column is a valid no-JS,
reduced-motion and print fallback. The right column lazy-loads an official
ThreeUI component only when its specimen is near the viewport. Real product
copy remains in the DOM; ThreeUI is `aria-hidden` visual enhancement only.

## Implementation controls

- Direct component imports use package subpaths rather than the all-exports
  entry point.
- The React island is client-loaded, while each ThreeUI component and its CSS
  are dynamically imported on intersection.
- A specimen is unmounted after it leaves the viewport, which pauses the
  render loop and allows the package-owned disposal path to run. The package's
  `BookshelfScene` explicitly disconnects resize listeners and disposes its
  renderer, geometries and materials on unmount.
- The package's source renderers cap device pixel ratio at `2`; the heavier
  `BookshelfScene` renderer uses `1.5` below 820 CSS pixels. The harness keeps
  visual frames bounded to the specimen surface and exposes
  `data-pixel-ratio-cap="2"` for instrumentation.
- `prefers-reduced-motion: reduce`, WebGL failure, no JavaScript and print all
  retain the static product primitive without loading a scene.

## Current judgement

CSS is the production winner for the membership card and cancellation counter:
the contract is state, copy and legible records, where ThreeUI's fixed iframe
art direction introduces unrelated visual language. The correspondence material
study is the only promising enhancement. It should remain an internal or
consentful route until its palette, copy and interaction model are adapted to
Plans With You rather than the package's generic textile demo.

ThreeUI is not recommended for public production at this stage. The visual
signature improvement is not yet material enough to justify a WebGL dependency,
separate renderer/iframe work, or its asset cost on the public bundle.

## Independent art-direction verdict

A fresh reviewer inspected every desktop/mobile capture after implementation
and returned **do not ship ThreeUI publicly**:

1. The semantic HTML/CSS membership card and cancellation stack are the clear
   product winners. They preserve real state, copy, and the cream/cobalt/
   vermilion Dispatch Wall language.
2. `WovenCloth` is the only spatial treatment with meaningful tactile promise,
   but its fixed demo copy, burgundy palette, generic banner shape, and passive
   auto-motion are not Plans With You. Keep it internal until it can represent
   a real open/read correspondence interaction.
3. `EngravedCertificate` is polished but reads as generic/faux-heritage art and
   does not communicate member, tier, plan, or invitation.
4. `DataField` removes the cancellation record and turns successful fulfilment
   into an empty dark field; the same texture could be achieved cheaply in SVG.

This closes the production question for the current package release: **ship no
ThreeUI scene**. Continue with HTML/CSS/Motion and keep the public bundle free of
Three/WebGL. The correspondence experiment remains an internal research lead,
not a deferred production commitment.

## Build measurements

Fresh `pnpm build` plus `pnpm perf:budget` (24 August 2026) passed the hard
budget. The largest optional candidate assets were:

| Asset                      |      Raw |     gzip | Role                               |
| -------------------------- | -------: | -------: | ---------------------------------- |
| `NeuformIsolatedEffects`   |  515 KiB |  123 KiB | `data-field` iframe source         |
| `three.module`             |  490 KiB |  122 KiB | Three runtime shared by the field  |
| `NeuformBatchEffects`      |  339 KiB |   69 KiB | package shared batch effects       |
| `WovenCloth`               |  148 KiB | 36.8 KiB | correspondence material iframe     |
| `ThreeUIBakeoff` harness   |  9.6 KiB |  3.7 KiB | comparison island and lazy imports |
| ThreeUI bakeoff stylesheet | 65.2 KiB | 25.6 KiB | internal-only route styling        |

`BookshelfScene` was measured separately at approximately 1,502 KiB raw /
775 KiB gzip and is therefore excluded from the implementation. The current
public-route budget remains PASS because the ThreeUI chunks are only reachable
from the operator-protected internal route and are dynamically imported after
intersection; no public production page imports them.

## Captured visual evidence

Playwright captures are stored outside public assets:

- `output/playwright/threeui-bakeoff-desktop-active.png` — 1440px full-page
  comparison with active EngravedCertificate, WovenCloth and DataField scenes.
- `output/playwright/threeui-bakeoff-correspondence.png` — focused desktop
  correspondence candidate with the textile scene mounted.
- `output/playwright/threeui-bakeoff-cancellation.png` — focused desktop
  cancellation candidate with the data field mounted.
- `output/playwright/threeui-bakeoff-mobile-reduced.png` — 390×844 reduced
  motion first viewport; all ThreeUI scenes remain static fallbacks and there
  is no horizontal overflow.
- `output/playwright/threeui-bakeoff-mobile-reduced-full.png` — full mobile
  reduced-motion fallback comparison.

Bundle numbers come from a clean `pnpm build` output; they are not inferred
from the internal route's development module graph.

## Risks / follow-up

- The official package contains iframe `srcDoc` scenes, some of which carry
  their own fixed art direction and font payloads. `BookshelfScene` measures
  approximately 1,502 KiB raw / 775 KiB gzip in this build, above the project's
  500 KiB single-JS hard ceiling, and is not loaded by the bakeoff route. A
  future production candidate must first prove a Plans With You-specific scene
  or a narrowly adapted renderer.
- The right column is intentionally a visual study, not a claim that a member
  card, booking, venue, or correspondence record exists. All fixtures are
  labelled.
- If a future candidate is promoted, add a route-level performance budget and
  browser evidence for context loss, reduced motion, mobile overflow and
  teardown before changing a public route.
