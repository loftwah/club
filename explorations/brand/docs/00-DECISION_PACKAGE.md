# Phase 2 Decision Package

> **Date:** 2026-08-23
> **Status:** READY FOR USER DECISION
> **Phase:** 2 — naming, branding, visual exploration
> **Phase 1 foundation:** PASS (`mise run acceptance` is green)

This is the complete Phase 2 decision package. It is the document the
user reads to choose a name, choose a direction, and lock (or reject)
the recommendations. Nothing in this document is locked until the user
says so. Everything in this document is a _decision the user owns_.

A working comparison page exists at `/brand-explorer/` and is
excluded from the public sitemap. The decision-package text below
reproduces everything in one place so the user does not have to
navigate the repo to make the call.

---

## Foundation acceptance

```text
$ mise run acceptance
ACCEPTANCE: PASS
```

Phase 1 (the engineering foundation — Cloudflare Workers, D1, R2,
Resend, the waiting-list flow, state machines, the canonical
acceptance command) is solid. The brand-exploration work did not
break the foundation. Tests, typecheck, lint, format, build, and the
acceptance script all pass.

The previous session left a formatting drift on the brand-explorer
files. The current session fixed the drift before running acceptance.

---

## Recovery summary

What the previous session had already completed (and is preserved):

- `explorations/brand/docs/01-naming.md` — 28 candidate names with
  rationale, tone, lore potential, SEO risk, and domain options.
- `explorations/brand/docs/02-shortlist.md` — five finalists with
  twelve-criterion review each, and a recommended choice.
- `explorations/brand/docs/03-direction-a-modernist-institution.md`
  — full direction-A spec: positioning, typography, palette, mark,
  stationery, artefacts, imagery, ThreeUI, mobile, copy samples.
- `explorations/brand/docs/04-direction-b-old-world-society.md` —
  full direction-B spec (same schema).
- `explorations/brand/docs/05-direction-c-quiet-modern.md` — full
  direction-C spec (same schema).
- `explorations/brand/assets/{a,b,c}/` — 24 generated JPGs (8 slots ×
  3 directions).
- `public/explorations/brand/assets/{a,b,c}/` — same 24 JPGs,
  duplicated for static serving.
- `src/pages/brand-explorer.astro` — internal comparison page
  (throwaway, noindex).
- `src/components/ThreeUISealPrototype.tsx` — ThreeUI prototype that
  actually mounts the `EngravedCertificate` component.
- `src/styles/brand-explorer.css` — page-local styles.
- `src/components/SocietySeal.tsx` — no-op shell that imports the
  ThreeUI package (Phase 1).

What the current session completed (and is preserved):

- Formatted the brand-explorer files (prettier) to unblock
  acceptance.
- Re-ran `mise run acceptance`; **PASS**.
- Wrote `public/explorations/brand/seals/seal-a-modernist.svg`,
  `seal-b-old-world.svg`, `seal-c-quiet-modern.svg` — the production
  SVG seals that replace the AI-garbled `seal_001.jpg` references.
  These are AI-typography-free and ship-ready.
- Wrote `explorations/brand/ASSET_INVENTORY.md` — per-asset
  assessment (Strong / Concept-only / Replace-with-SVG / Keep).
- Wrote `explorations/brand/PROVENANCE.md` — honest generation
  provenance, including the gap that prompt/seed/dimensions are
  inferred, not preserved.
- Wrote `explorations/brand/docs/06-threeui-evaluation.md` — what
  ThreeUI is good for, what it is not, the canonical mount pattern,
  and the per-direction recommendation.
- Wrote `explorations/brand/docs/07-og-social-system.md` — the OG /
  social image system: per-route asset list, safe-zone rules,
  recommended SVG template.
- Wrote `explorations/brand/INDEX.md` — directory index so the user
  can navigate the brand work.
- Wrote this document, `00-DECISION_PACKAGE.md`.

What was discarded and why:

- No assets were discarded. The previous session's 24 JPGs are
  retained as concept gallery. The `seal_001.jpg` references are
  _replaced in production use_ by the SVG seals, but the JPG
  references remain in `explorations/brand/assets/` for visual
  comparison.

---

## Naming

### 25+ candidates (28 total)

The full list lives in
`explorations/brand/docs/01-naming.md`. It is reproduced here in
summary form. Each name was judged against the criteria in
`docs/03_BRAND_NAMING_COPY_SEO.md` §4.3 and §4.4.

**Inherited from the spec (8):**

1. The Deferred Society
2. The Society of Considered Absence
3. The Absent Society
4. The Quiet Assembly
5. The Unattended Society
6. The Society of Cancelled Engagements
7. The Last-Minute Society
8. The Society for Regrettable Commitments

**New — institutional / member-state (8):**

9. The Reserved Society
10. The Standing Society
11. The Constant Society
12. The Continuing Society
13. The Recurrent Society
14. The Longstanding Society
15. The Faithful Society
16. ~~The Reliable Society~~ (rejected as too service-brand)

**New — correspondence-led (5):**

17. The Mailed Society
18. The Pen Society
19. The House of Recurrent Letters
20. The Society of Unanswered Letters
21. The Cordial Society

**New — status / register (4):**

22. The Considerate Society
23. The Sociable Society
24. The Plenary Society
25. The Relieved Society

**New — playful-institutional (3):**

26. The Late Reply Society
27. The Standing Invitation
28. The Sub Rosa Society

### Five finalists

The full review with twelve criteria each is in
`explorations/brand/docs/02-shortlist.md`. The five finalists:

1. **The Reserved Society**
2. **The Standing Society**
3. **The Deferred Society**
4. **The Mailed Society**
5. **The Quiet Assembly**

### Recommendation (advisory only — not locked)

**The Reserved Society.**

The reason: "Reserved" carries two institutional meanings — _kept
aside for you_ and _quiet / not loud_ — and the product does both. A
reader who arrives at the homepage, sees the wordmark, and is invited
to _belong without showing up_, will read "Reserved" as the literal
description of what the institution is, not as a pun. The pun, when
it lands, lands quietly. That is the brief.

The second choice is **The Standing Society**, for the constitutional
feel and the strong "standing member" semantics. It is a slightly
more serious, slightly less warm name.

The user decides.

### Domain direction

The locked public URL is `https://club.loftwah.com` and that does not
change. The name is the _brand under that URL_, not a separate domain.
A dedicated domain (e.g. `thereservedsociety.com`,
`thereservedsociety.au`) is a Phase 3+ decision, not Phase 2.

---

## Direction A — Modernist Institution

> _A contemporary learned society. Mid-century editorial rigour. No
> ornament that does not earn its place._

| Aspect           | Specification                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Positioning**  | Mid-century Swiss editorial register. Old money in modern dress. The Society as serious institution first, membership club second.      |
| **Display font** | Söhne (paid) or Inter 800 (OFL fallback)                                                                                                |
| **Body font**    | Söhne Buch or Inter Regular                                                                                                             |
| **Mono**         | GT America Mono or JetBrains Mono                                                                                                       |
| **Palette**      | `--ink #0F1115` · `--paper #F4F1EA` · `--paper-deep #EAE4D6` · `--ink-soft #3A3F47` · `--rule #1B1E23` · `--signal #C8462C` (vermilion) |
| **Wordmark**     | `RESERVED` in heavy grotesque, `THE … SOCIETY` as spaced-mono running line                                                              |
| **Monogram**     | Interlocked R + S in a 1-pt rule circle                                                                                                 |
| **Seal**         | `public/explorations/brand/seals/seal-a-modernist.svg` (monoline circle + arc text + monogram)                                          |
| **ThreeUI**      | Hero seal only — `EngravedCertificate` (light, neutral) on top of static SVG                                                            |
| **Mobile**       | Wordmark stays on one line; running line drops below 360 px                                                                             |
| **OG / social**  | Wide negative-space composition, single seal centred low, real typography (SVG-rendered JPG)                                            |

### Copy samples (A)

_Hero:_ **The Reserved Society.** A real membership institution. You
are kept on the list, written to in your own time, and not expected
to attend.

_CTA:_ Apply to the waiting list.

_Invitation:_ 14 November, 7:30 pm. The reading room, chapter
Melbourne. A small, ordinary evening, with two of the other members.
Dress is whatever you were going to wear.

_Cancellation:_ 14 November, 7:30 pm — Cancelled. The reading room
is dark and the kettle is off. We will write again in the spring.

_Birthday:_ Happy birthday, R. A small card is in the post. The
Society does not need you to do anything about it.

_Lore:_ Founded in the year of the second consecutive cancellation,
the Reserved Society began as a private list of names kept beside an
empty table at a now-closed restaurant in the inner suburbs. The
restaurant has been gone for a long time. The list is the institution.

### Visual candidates (A)

| Slot         | Path                                                   | Status                       |
| ------------ | ------------------------------------------------------ | ---------------------------- |
| Hero         | `public/explorations/brand/assets/a/hero_001.jpg`      | concept                      |
| Seal         | `public/explorations/brand/seals/seal-a-modernist.svg` | production-ready             |
| Card         | `public/explorations/brand/assets/a/card_001.jpg`      | concept (typography → HTML)  |
| Invitation   | `public/explorations/brand/assets/a/invite_001.jpg`    | concept (typography → HTML)  |
| Cancellation | `public/explorations/brand/assets/a/cancel_001.jpg`    | concept                      |
| OG default   | `public/explorations/brand/assets/a/og_001.jpg`        | concept (re-render with SVG) |
| Archival     | `public/explorations/brand/assets/a/archive_001.jpg`   | concept                      |
| Medallion    | `public/explorations/brand/assets/a/artefact_001.jpg`  | concept                      |

The full direction-A spec is at
`explorations/brand/docs/03-direction-a-modernist-institution.md`.

---

## Direction B — Old-World Society

> _A late-Victorian learned society, kept up to date. Engraved metal,
> cream paper, deep pigment. The door is closed by design._

| Aspect           | Specification                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Positioning**  | Late-19th-century British learned society register. The Society as old money — the kind of institution that prints its name in metal. |
| **Display font** | GT Sectra (paid) or Cormorant Garamond (OFL fallback)                                                                                 |
| **Body font**    | Source Serif 4 (OFL)                                                                                                                  |
| **Mono**         | IBM Plex Mono                                                                                                                         |
| **Palette**      | `--ink #0E0B08` · `--paper #F2EAD8` · `--oxblood #5C1A1B` · `--forest #1F3A2E` · `--brass #A4833A` · `--ink-soft #3A2F22`             |
| **Wordmark**     | `RESERVED` in high-contrast Roman display, all small caps, with twin-star ornaments                                                   |
| **Monogram**     | Interlocked R + S with leaf ornament on the R's terminal                                                                              |
| **Seal**         | `public/explorations/brand/seals/seal-b-old-world.svg` (rope-twist border, oxblood centre)                                            |
| **ThreeUI**      | Hero seal + medallion mount (desktop only, ≥600 px)                                                                                   |
| **Mobile**       | Medallion replaced by static SVG below 600 px; seal scales to 220–320 px square                                                       |
| **OG / social**  | Wide walnut composition, single oxblood seal, real typography (SVG-rendered JPG)                                                      |

### Copy samples (B)

_Hero:_ **The Reserved Society.** Founded in the year of the second
consecutive cancellation. A private institution for members who are
not expected to attend.

_CTA:_ Submit your name to the waiting list.

_Invitation:_ The Society requests the pleasure of your company. 14
November, half-past seven. The reading room, chapter Melbourne. A
small, ordinary evening, with two of the other members. Dress is
whatever you were going to wear.

_Cancellation:_ The Society regrets. 14 November, half-past seven —
Cancelled. The reading room is dark and the kettle is off. We shall
write again in the spring.

_Birthday:_ On the occasion of your birthday. A small card is in the
post. The Society does not require a reply, a phone call, or any
other evidence of your continued membership.

_Lore:_ Founded in the year of the second consecutive cancellation.
The Reserved Society began as a private list of names kept beside an
empty table at a now-closed restaurant in the inner suburbs. The
restaurant has been gone for a long time. The list is the
institution.

### Visual candidates (B)

| Slot         | Path                                                   | Status                       |
| ------------ | ------------------------------------------------------ | ---------------------------- |
| Hero         | `public/explorations/brand/assets/b/hero_001.jpg`      | concept                      |
| Seal         | `public/explorations/brand/seals/seal-b-old-world.svg` | production-ready             |
| Card         | `public/explorations/brand/assets/b/card_001.jpg`      | concept (typography → HTML)  |
| Invitation   | `public/explorations/brand/assets/b/invite_001.jpg`    | concept (typography → HTML)  |
| Cancellation | `public/explorations/brand/assets/b/cancel_001.jpg`    | concept                      |
| OG default   | `public/explorations/brand/assets/b/og_001.jpg`        | concept (re-render with SVG) |
| Archival     | `public/explorations/brand/assets/b/archive_001.jpg`   | concept                      |
| Medallion    | `public/explorations/brand/assets/b/artefact_001.jpg`  | concept                      |

The full direction-B spec is at
`explorations/brand/docs/04-direction-b-old-world-society.md`.

---

## Direction C — Quiet Modern

> _A small correspondence institution, run like a journal. Warm,
> restrained, a little melancholic. The page is the medium._

| Aspect           | Specification                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Positioning**  | Small literary quarterly register. The Society as a bookshop that writes to you.                                                              |
| **Display font** | Fraunces (OFL) — soft contemporary serif                                                                                                      |
| **Body font**    | Fraunces 400 with SOFT axis                                                                                                                   |
| **Mono**         | JetBrains Mono or IBM Plex Mono                                                                                                               |
| **Palette**      | `--ink #1B1A17` · `--paper #F6F0E2` · `--paper-deep #ECE3CE` · `--dust #C9B998` · `--sage #7A8C6B` · `--brick #A8503B` · `--ink-soft #5A544A` |
| **Wordmark**     | `Reserved` in Fraunces italic, sentence-case, no small caps, no tracking                                                                      |
| **Monogram**     | Hand-drawn R, slightly off-axis, drawn in 2-pt ink line                                                                                       |
| **Seal**         | `public/explorations/brand/seals/seal-c-quiet-modern.svg` (hand-drawn circle, mono arc text)                                                  |
| **ThreeUI**      | Membership card embossed look only (desktop, ≥600 px)                                                                                         |
| **Mobile**       | Card replaced by static SVG below 600 px; wordmark scales 32–64 pt                                                                            |
| **OG / social**  | Warm wood + fountain pen + hand-drawn monogram, real typography (SVG-rendered JPG)                                                            |

### Copy samples (C)

_Hero:_ **The Reserved Society.** A small correspondence institution,
run like a journal. You are not expected to attend.

_CTA:_ Add your name to the list.

_Invitation:_ 14 November, half-past seven. The reading room, chapter
Melbourne. Two of the other members. A small, ordinary evening. Dress
is whatever you were going to wear.

_Cancellation:_ 14 November, half-past seven — cancelled. The reading
room is dark and the kettle is off. We will write again in the spring.

_Birthday:_ On the occasion of your birthday. A small card is in the
post. The Society does not require a reply.

_Lore:_ Founded in the year of the second consecutive cancellation.
The Reserved Society began as a private list of names kept beside an
empty table at a now-closed restaurant in the inner suburbs. The
restaurant has been gone for a long time. The list is the institution.

### Visual candidates (C)

| Slot         | Path                                                      | Status                       |
| ------------ | --------------------------------------------------------- | ---------------------------- |
| Hero         | `public/explorations/brand/assets/c/hero_001.jpg`         | concept                      |
| Seal         | `public/explorations/brand/seals/seal-c-quiet-modern.svg` | production-ready             |
| Card         | `public/explorations/brand/assets/c/card_001.jpg`         | concept (typography → HTML)  |
| Invitation   | `public/explorations/brand/assets/c/invite_001.jpg`       | concept (typography → HTML)  |
| Cancellation | `public/explorations/brand/assets/c/cancel_001.jpg`       | concept                      |
| OG default   | `public/explorations/brand/assets/c/og_001.jpg`           | concept (re-render with SVG) |
| Archival     | `public/explorations/brand/assets/c/archive_001.jpg`      | concept                      |
| Medallion    | `public/explorations/brand/assets/c/artefact_001.jpg`     | concept                      |

The full direction-C spec is at
`explorations/brand/docs/05-direction-c-quiet-modern.md`.

---

## Side-by-side comparison

| Axis               | A · Modernist Institution                       | B · Old-World Society                                | C · Quiet Modern                                         |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Institutional feel | Mid-century museum                              | Late-Victorian learned society                       | Small literary quarterly                                 |
| Tone               | Cool, editorial, restrained                     | Severe, material, institutional                      | Warm, soft, melancholic                                  |
| Single colour cue  | Vermilion `#C8462C`                             | Oxblood `#5C1A1B` + brass `#A4833A`                  | Sage `#7A8C6B` + brick `#A8503B`                         |
| Material           | Cream paper + spot-ink                          | Cream paper + brass + wax + walnut                   | Warm paper + walnut + ink                                |
| Display face       | Söhne / Inter 800 (heavy grotesque)             | GT Sectra / Cormorant Garamond (high-contrast serif) | Fraunces (soft contemporary serif)                       |
| Wordmark           | Heavy grotesque, small caps running line        | Roman display small caps, twin-star ornament         | Fraunces italic, sentence-case, no tracking              |
| Seal motif         | Monoline circle, interlocked RS                 | Rope-twist border, oxblood centre, leaf RS           | Hand-drawn wobbly circle, hand-drawn R                   |
| Imagery            | Editorial documentary, Granta-style             | Painterly documentary, NYRB-style                    | Warm late-afternoon, Paris-Review-style                  |
| ThreeUI            | Hero seal                                       | Hero seal + medallion (desktop)                      | Membership card emboss (desktop)                         |
| Mobile behaviour   | Wordmark + running line                         | Medallion → static SVG < 600 px                      | Card → static SVG < 600 px                               |
| Strongest asset    | `cancel_001.jpg`                                | `hero_001.jpg` and `invite_001.jpg`                  | All eight (cohesive set)                                 |
| AI-typography risk | High (3 of 8)                                   | Medium (2 of 8)                                      | Low (0 of 8)                                             |
| Production seal    | `seals/seal-a-modernist.svg`                    | `seals/seal-b-old-world.svg`                         | `seals/seal-c-quiet-modern.svg`                          |
| Risk               | May read as too neutral / too clean             | May read as expensive / private                      | May read as a bookshop                                   |
| Lore fit           | Strong — the in-house style of a real editorial | Strongest — old-world reads as old institution       | Weaker — the softest register may under-institutionalise |

---

## Recommended combination

**Name:** _The Reserved Society._
**Direction:** _Direction A — Modernist Institution_ (with
optional Direction-B material cues if the user wants more weight).

### Why

The name "Reserved" does two pieces of work at once — _we keep
something aside for you_ and _we are quiet about it_ — and both
pieces of work are exactly what the product does. The pun lands
quietly. That is the brief.

Direction A is the **safest, most restrained, most SEO-friendly**
direction of the three. It is also the **most readable on a phone
preview** and the most consistent in its imagery. The vermilion
single-accent system means the brand reads as serious without ever
becoming expensive. The wordmark is a heavy grotesque, which
performs well at small sizes and is fully OFL if the user does not
approve Söhne.

The Direction-B cues — oxblood wax seal, brass detail, walnut desk
— are **optional** additions rather than a separate direction. A
Phase 3 build can include a Direction-B-flavoured card and
cancellation without changing the production typography or the
production seal.

### Risks

- **Name is a double meaning.** "Reserved" can read as snobbish or
  expensive-gated in the wrong context. The brand voice (warm,
  dry, no sales pressure) and the hero copy (A$5 / A$20 / A$50
  are not expensive) defuse this.
- **"Reserved" is a word used by a Polish fashion brand.** Not a
  conflict because the Social Club is not a fashion brand, but a
  casual reader may briefly confuse them. **Trademark clearance is
  the user's responsibility, not the model's.**
- **Direction A may read as too clean.** A reserved Swiss register
  is the right choice for the brief, but a user who wants the
  _most distinctive_ visual identity might prefer Direction B.
- **All visuals are still concept-only.** The 24 JPGs are gallery
  references; the 3 SVG seals are production-ready. Real production
  needs HTML/SVG typography for every text-bearing surface.
- **No dedicated domain has been reserved.** `thereservedsociety.com`
  / `.au` / `.society` is a Phase 3+ decision.

---

## Generated asset inventory (full)

### Production-ready (canonical)

| Path                                                      | Use                           |
| --------------------------------------------------------- | ----------------------------- |
| `public/explorations/brand/seals/seal-a-modernist.svg`    | Direction-A seal (production) |
| `public/explorations/brand/seals/seal-b-old-world.svg`    | Direction-B seal (production) |
| `public/explorations/brand/seals/seal-c-quiet-modern.svg` | Direction-C seal (production) |

### Concept gallery (decision-time references)

| Path                                                  | Direction | Slot            |
| ----------------------------------------------------- | --------- | --------------- |
| `public/explorations/brand/assets/a/hero_001.jpg`     | A         | hero            |
| `public/explorations/brand/assets/a/seal_001.jpg`     | A         | seal (replaced) |
| `public/explorations/brand/assets/a/card_001.jpg`     | A         | card            |
| `public/explorations/brand/assets/a/invite_001.jpg`   | A         | invite          |
| `public/explorations/brand/assets/a/cancel_001.jpg`   | A         | cancel          |
| `public/explorations/brand/assets/a/og_001.jpg`       | A         | OG default      |
| `public/explorations/brand/assets/a/archive_001.jpg`  | A         | archive         |
| `public/explorations/brand/assets/a/artefact_001.jpg` | A         | medallion       |
| `public/explorations/brand/assets/b/hero_001.jpg`     | B         | hero            |
| `public/explorations/brand/assets/b/seal_001.jpg`     | B         | seal (replaced) |
| `public/explorations/brand/assets/b/card_001.jpg`     | B         | card            |
| `public/explorations/brand/assets/b/invite_001.jpg`   | B         | invite          |
| `public/explorations/brand/assets/b/cancel_001.jpg`   | B         | cancel          |
| `public/explorations/brand/assets/b/og_001.jpg`       | B         | OG default      |
| `public/explorations/brand/assets/b/archive_001.jpg`  | B         | archive         |
| `public/explorations/brand/assets/b/artefact_001.jpg` | B         | medallion       |
| `public/explorations/brand/assets/c/hero_001.jpg`     | C         | hero            |
| `public/explorations/brand/assets/c/seal_001.jpg`     | C         | seal (replaced) |
| `public/explorations/brand/assets/c/card_001.jpg`     | C         | card            |
| `public/explorations/brand/assets/c/invite_001.jpg`   | C         | invite          |
| `public/explorations/brand/assets/c/cancel_001.jpg`   | C         | cancel          |
| `public/explorations/brand/assets/c/og_001.jpg`       | C         | OG default      |
| `public/explorations/brand/assets/c/archive_001.jpg`  | C         | archive         |
| `public/explorations/brand/assets/c/artefact_001.jpg` | C         | medallion       |

### Throwaway prototype (decision-time only)

| Path                                      | Use                                             |
| ----------------------------------------- | ----------------------------------------------- |
| `src/pages/brand-explorer.astro`          | Internal comparison page; excluded from sitemap |
| `src/components/ThreeUISealPrototype.tsx` | Mounts the real ThreeUI `EngravedCertificate`   |
| `src/styles/brand-explorer.css`           | Page-local styles                               |

---

## Acceptance

```text
$ mise run acceptance
… 9/9 gates green, 12.97s equivalent, all tests pass …
ACCEPTANCE: PASS
```

Phase 1 tests still pass. The brand-explorer additions did not regress
any production code path. `mise run acceptance` was the last command run
before this document was written.

---

## Open decisions requiring user

The following are **the only decisions the user owns**. None of them
have been silently locked by either the previous session or the current
session. They are the open decisions in
`docs/18_LOCKED_AND_OPEN_DECISIONS.md` that are part of Phase 2:

1. **Final club name** — top recommendation: _The Reserved Society_;
   fallback: _The Standing Society_.
2. **Final brand direction** — top recommendation: _Direction A
   (Modernist Institution)_; with optional Direction-B material cues.
3. **Logo / crest** — the production seal SVG for the chosen
   direction is ready; the wordmark is specified in the direction doc
   but not yet drawn. (Phase 3 work; the user can approve the spec and
   hand the wordmark to a type foundry, or use the direction's
   recommended OFL fallback for now.)
4. **Final palette** — the palette in the chosen direction doc is the
   recommended palette. The user approves or adjusts.
5. **Final fonts** — the recommended face and OFL fallback are
   specified per direction. The user approves the recommended face
   (which is a paid licence) or the OFL fallback.
6. **Final tagline** — none of the three directions is locked to a
   tagline. The `PROPOSITION` candidate ("You belong. You are invited.
   You are remembered. You do not have to show up.") is from
   `docs/03_BRAND_NAMING_COPY_SEO.md` §4.11 and the user is the only
   one who can lock it.

A note on items 1–6: every one of these items is in the project's
"Ask before locking" list in `AGENTS.md` and
`docs/18_LOCKED_AND_OPEN_DECISIONS.md`. The decision package's
recommendations are advisory; the user decides.

---

## Phase 2 → Phase 3 handoff (not yet started)

Phase 3 begins when the user locks a name, a direction, a palette,
fonts, and a tagline. Phase 3 work includes:

- Replace placeholder copy on `/`, `/membership`, `/how-it-works`,
  `/chapters`, `/journal`, `/waiting-list` with the chosen direction's
  copy and palette.
- Implement the production hero seal mount using the chosen direction's
  SVG seal and ThreeUI enhancement.
- Generate the per-route OG assets (`/membership`, `/how-it-works`,
  `/journal`, `/chapters/*`, `/waiting-list`).
- Move from the throwaway brand-explorer page to a public `/about` or
  `/manifesto` page if the user wants the brand visible in
  information architecture.

Phase 3 is **explicitly not started** in this session. The decision
package is the end of Phase 2.
