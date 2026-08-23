# Brand Explorations — Index

> **Date:** 2026-08-23
> **Status:** Phase 2 · decision package

This index is the entry point to every document and asset produced
during Phase 2. Phase 2 was a _decision_ phase, not an implementation
phase. Nothing in this directory should be deployed or used as a
production page; the files here exist to support a single decision
moment: which name, which direction, which palette, which fonts,
which tagline the user locks.

The exception is `public/explorations/brand/seals/*.svg`, which are
production-ready SVG seals. A Phase 3 build can use them directly
without waiting for the user to revisit typography.

---

## Reading order for the user

1. `docs/00-DECISION_PACKAGE.md` — the whole decision in one place.
2. `docs/01-naming.md` — 28 candidate names with rationale.
3. `docs/02-shortlist.md` — five finalists with twelve-criterion
   review each, and the recommended name.
4. `docs/03-direction-a-modernist-institution.md` — Direction A spec.
5. `docs/04-direction-b-old-world-society.md` — Direction B spec.
6. `docs/05-direction-c-quiet-modern.md` — Direction C spec.
7. `docs/06-threeui-evaluation.md` — what to do with ThreeUI.
8. `docs/07-og-social-system.md` — OG / social image system.
9. `ASSET_INVENTORY.md` — per-asset quality assessment.
10. `PROVENANCE.md` — honest generation log + known gaps.

## Visual reference

- `/brand-explorer/` — internal comparison page (excluded from
  sitemap). Shows all three directions side by side with the SVG
  seal + ThreeUI prototype.

## Files

```text
explorations/brand/
├── INDEX.md                                    ← you are here
├── ASSET_INVENTORY.md                          ← per-asset assessment
├── PROVENANCE.md                               ← generation log
├── docs/
│   ├── 00-DECISION_PACKAGE.md                  ← READ THIS FIRST
│   ├── 01-naming.md
│   ├── 02-shortlist.md
│   ├── 03-direction-a-modernist-institution.md
│   ├── 04-direction-b-old-world-society.md
│   ├── 05-direction-c-quiet-modern.md
│   ├── 06-threeui-evaluation.md
│   └── 07-og-social-system.md
└── assets/                                     ← concept gallery
    ├── a/  (8 JPGs)
    ├── b/  (8 JPGs)
    └── c/  (8 JPGs)

public/explorations/brand/
└── seals/                                      ← production SVG
    ├── seal-a-modernist.svg
    ├── seal-b-old-world.svg
    └── seal-c-quiet-modern.svg
(plus the mirrored /assets/{a,b,c}/ JPGs for the brand-explorer page)

src/
├── pages/brand-explorer.astro                  ← internal comparison page
├── components/ThreeUISealPrototype.tsx         ← ThreeUI prototype
└── styles/brand-explorer.css                   ← page-local styles
```

## What is locked

Nothing in this directory is locked. The user owns every decision.

## What is production-ready

Only the three SVG seals in `public/explorations/brand/seals/`. They
have real SVG typography and no AI-garbled text. They are safe to
ship.
