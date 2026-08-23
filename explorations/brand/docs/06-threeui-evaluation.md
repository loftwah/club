# ThreeUI Evaluation

> **Date:** 2026-08-23
> **Status:** Phase 2 · decision package

This note is the canonical evaluation of **where ThreeUI should and
should not be used** in the Social Club brand and product. It follows
the spec invariant in `docs/03_BRAND_NAMING_COPY_SEO.md` §4.9:

> Critical content remains semantic DOM HTML and must work when WebGL
> is unavailable, JavaScript is delayed, reduced motion is enabled, or
> the mobile GPU is weak.

The current installed package is `@designcodeio/threeui` v0.3.0. The
relevant component for the brand seal is `EngravedCertificate`, which
mounts as a React component and renders a brushed-metal engraved
surface. It accepts `mode` (`"light" | "dark"`), `hue`, `saturation`,
and `brightness` props.

The current `src/components/SocietySeal.tsx` is a no-op shell (it
imports the package but only sets a data-attribute, not a canvas). The
prototype in `src/components/ThreeUISealPrototype.tsx` actually mounts
the component and is reachable from `/brand-explorer/`.

---

## 1. What ThreeUI is good for here

A ThreeUI component is appropriate when the visual element is:

1. **Representational of a physical object** (a seal, a medallion, a
   wax-stamp, a brass pin), so the 3D is _describing_ something
   material, not _replacing_ HTML.
2. **Slow to read** — the eye lingers on it, so a 2.5 s slow reveal
   adds value rather than nuisance.
3. **Optional** — the static SVG fallback is the canonical
   representation; ThreeUI is the enhancement.
4. **Bounded** — one island, one canvas, one animation.

Candidates that meet all four:

| Use case                      | Why it fits                                                    | Component candidate                                                                   |
| ----------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Hero seal                     | A seal is a single, small, bounded, optional object            | `EngravedCertificate` (Direction A · C) or a custom brushed-brass plate (Direction B) |
| Membership card (Direction B) | The card is the most material artefact in the system           | `EngravedCertificate` with warm-tone tweak, or a custom matte card scene              |
| Medallion (Direction B)       | A medallion is the most physical object in the artefact system | Custom ThreeUI scene, or `EngravedCertificate` re-skinned                             |

---

## 2. What ThreeUI is NOT good for here

| Use case                                            | Why it does not fit                                        | Use instead                                    |
| --------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| Hero **text** or letterpress rolls                  | Text is critical; 3D is unreliable for typography          | Real HTML/SVG typography                       |
| Parallax sections                                   | Decorative, not representational                           | CSS `@scroll-timeline` or no animation         |
| Particle systems on hover                           | Decorative                                                 | Nothing                                        |
| Background animation                                | The product page should be quiet                           | Solid `--paper` background                     |
| Replacing the static SVG seal as the canonical seal | The SVG is the source of truth; ThreeUI is the enhancement | SVG seal in `public/explorations/brand/seals/` |
| Long-form text / article body                       | Reduces accessibility, fails SEO invariant                 | Semantic HTML                                  |
| OG / social share image                             | 3D does not render in social previews                      | Static JPG/PNG at 1200×630                     |
| Email visual language                               | Most email clients block JS and 3D                         | Static image fallback                          |

---

## 3. The mount pattern (canonical)

The pattern below is what the prototype in
`src/components/ThreeUISealPrototype.tsx` already implements and is the
only correct pattern:

```text
1. Server-render a static SVG <svg role="img" aria-label="...">.
2. On the client island, import the ThreeUI component and CSS.
3. If prefers-reduced-motion OR WebGL is unavailable OR GPU is
   weak (capability, not screen size) → keep the static SVG.
4. Otherwise, mount the ThreeUI component on top of the SVG.
5. The ThreeUI scene fades or sits over the SVG; it does not
   *replace* the DOM node so crawlers and screen readers still see
   the SVG.
6. The animation runs once on first reveal, then goes still.
7. No parallax. No particle effects. No shader effects.
```

The static SVG fallback is always there. ThreeUI is enhancement, not
content. The hero **h1, value proposition, and CTA are inside semantic
HTML, not inside the canvas**.

---

## 4. Per-direction recommendation

| Direction        | Use ThreeUI? | Where                                            | Component to use                                                                                                          |
| ---------------- | ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| A · Modernist    | **Yes**      | Hero seal                                        | `EngravedCertificate` (mode: `"light"`, neutral hue)                                                                      |
| B · Old-World    | **Yes**      | Hero seal + membership-card mount (desktop only) | `EngravedCertificate` re-skinned to brass; or a custom scene; replace with static SVG on `<600px`                         |
| C · Quiet Modern | **Yes**      | Membership card embossed look                    | `EngravedCertificate` (mode: `"light"`, very soft); or a custom embossed-paper scene; replace with static SVG on `<600px` |

Across all three directions, ThreeUI is mounted in **at most one place
per page**. The rest of the page is plain HTML/CSS.

---

## 5. The current state of the prototype

The prototype is reachable at `/brand-explorer/`. It renders three
cells:

1. A static SVG seal (the fallback, no JS).
2. The same seal rendered through `EngravedCertificate` in `light` mode.
3. The same seal rendered through `EngravedCertificate` in `dark` mode.

If the component fails to mount, the cell shows a "fallback" message
and the user can still see the static SVG. This is the correct
behaviour.

The prototype is **throwaway**: it lives in
`src/components/ThreeUISealPrototype.tsx`, the
`src/pages/brand-explorer.astro` page, and
`src/styles/brand-explorer.css`. It is excluded from the public sitemap
and not indexed. The decision package explicitly tells the user this
is the only place the prototype exists.

---

## 6. What is NOT yet done (and is OK to leave for Phase 3)

The following are ThreeUI work that _could_ be done but is **not** part
of Phase 2 and should not delay the decision:

- A polished hero seal production component (one per direction, used
  on `/`, `/membership`, `/how-it-works`, `/journal`).
- A production membership-card mount (Direction B).
- A reduced-motion-aware video fallback for environments where ThreeUI
  fails silently.

All three are Phase 3 work that follows the user locking a direction.
