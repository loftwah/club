# Phase 2 (Round 2) — Decision Package

> **Date:** 2026-08-23 (round 2)
> **Status:** READY FOR USER DECISION
> **Phase:** 2 — naming, branding, visual exploration (revised)
> **Phase 1 foundation:** PASS (`mise run acceptance` is green)

This is the complete Phase 2 decision package after the user's
correction. The previous round's recommendation (The Reserved Society

- Modernist Institution) is preserved as a **previous hypothesis** and
  re-evaluated against new work. The user has correctly identified that
  the previous round over-weighted heritage-society aesthetics, and
  this round rebuilds the exploration starting from the **customer
  experience**, not from a logo.

A working contact-sheet page exists at `/brand-r2/`. The previous
brand-explorer page (`/brand-explorer/`) is preserved as a
_previous-round reference_ but is no longer the canonical decision
surface.

Nothing in this document is locked until the user says so.

---

## Foundation acceptance

```text
$ mise run acceptance
ACCEPTANCE: PASS
```

Phase 1 (the engineering foundation) is solid. The new explorations
live entirely in `explorations/brand/r2-assets/`,
`public/explorations/brand/r2-assets/`, `src/pages/brand-r2.astro`,
and the new docs. No production code path was changed.

---

## Recovery summary

What the previous round had completed (preserved as a previous
hypothesis, not deleted):

- 28 candidate names with rationale — `docs/01-naming.md`
- 5 finalists with twelve-criterion review — `docs/02-shortlist.md`
- 3 brand directions (A · Modernist Institution, B · Old-World
  Society, C · Quiet Modern) — `docs/03…05`
- 24 generated JPG concept assets — `assets/{a,b,c}/` and mirrored
  in `public/explorations/brand/assets/{a,b,c}/`
- Internal comparison page — `src/pages/brand-explorer.astro`
- ThreeUI prototype — `src/components/ThreeUISealPrototype.tsx`
- Three production SVG seals (modernist, old-world, quiet-modern)
  — `public/explorations/brand/seals/*.svg`
- Asset inventory and provenance — `ASSET_INVENTORY.md`,
  `PROVENANCE.md`
- Previous decision package — `docs/00-DECISION_PACKAGE.md`

What this session completed (added):

- Repaired formatting drift on the brand-explorer files (prettier)
  so `mise run acceptance` would still pass.
- 41 candidate names with rationale, organised by the new
  emotional territory — `docs/01-naming-r2.md`.
- 5-name shortlist: The Reserved Society (inherited), Plans With
  You, The Always-Invited, Cordially, Membership Pending.
- 4 genuinely different visual worlds, each with positioning,
  typography, palette, identity, web, communications, physical,
  ThreeUI, OG/social, copy, and emotional scorecard —
  `docs/08-worlds-overview.md`.
- 32 generated JPG concept assets via `mmx image generate` (8 slots
  × 4 worlds) — `r2-assets/{w1,w2,w3,w4}/` and mirrored in
  `public/explorations/brand/r2-assets/{w1,w2,w3,w4}/`.
- New contact-sheet page — `src/pages/brand-r2.astro`.
- This document — `docs/09-DECISION-PACKAGE-R2.md`.

What was discarded: nothing. The previous round's 28 names, 3
directions, 24 JPGs, and 3 SVG seals are preserved. The previous
recommendation is re-evaluated honestly in §5 below.

---

## Existing-work assessment (the previous round, re-evaluated)

The user asked for an honest assessment of every existing Phase 2
asset, not a defence of it.

### Naming (previous round)

| Asset                            | Verdict          | Note                                                                                                     |
| -------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `docs/01-naming.md`              | USEFUL_REFERENCE | The 28 names are a good starting set; the emotional criteria were too thin.                              |
| `docs/02-shortlist.md`           | NEEDS_REWORK     | The five finalists (Reserved, Standing, Deferred, Mailed, Quiet Assembly) over-weight heritage register. |
| Recommendation: Reserved Society | NEEDS_REWORK     | Survives on its own as a name; the heritage-society aesthetic attached to it is not intrinsic.           |

The 28 names from the previous round are re-evaluated in
`01-naming-r2.md` §2. 5 names survive; 23 are dropped. The
shortlist is rebuilt from the new emotional territory.

### Brand directions (previous round)

| Direction                 | Verdict         | Note                                                                                                                                                                                                                                                 |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · Modernist Institution | NEEDS_REWORK    | The Mid-century editorial register is right; the heritage aesthetic is not. World 1 (On Schedule) in this round is the same calendar-mechanics idea without the heritage weight.                                                                     |
| B · Old-World Society     | WRONG_DIRECTION | Cream paper + oxblood wax + brass + walnut + engraved metal is exactly the heritage-society aesthetic the user has correctly identified as wrong. The B-grade JPGs in `assets/b/` confirm: this is the whisky-brand / menswear / heritage-bank trap. |
| C · Quiet Modern          | NEEDS_REWORK    | The hand-drawn warmth is good. The 3-of-3-oxblood-and-walnut wrap is the heritage trap again. World 2 (In The Post) in this round is the same warm-mailbox idea, expanded and stripped of the heritage-society residue.                              |

### Visual assets (previous round)

| Asset                         | Verdict                                              | Note                                                                                                         |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `assets/a/hero_001.jpg`       | STRONG                                               | Cream envelope, vermilion seal, soft window light.                                                           |
| `assets/a/seal_001.jpg`       | WRONG_DIRECTION                                      | The seal concept itself leans heritage; replaced by SVG.                                                     |
| `assets/a/cancel_001.jpg`     | STRONG                                               | Best of direction A. The cancellation as the brief.                                                          |
| `assets/a/og_001.jpg`         | STRONG                                               | Wide negative space, single seal.                                                                            |
| `assets/a/artefact_001.jpg`   | USEFUL_REFERENCE                                     | Brass medallion; the heritage weight is not intrinsic to the concept.                                        |
| `assets/b/hero_001.jpg`       | STRONG (visually) but WRONG_DIRECTION (conceptually) | This is the strongest single image of the previous round, and the most clearly in the heritage-society trap. |
| `assets/b/seal_001.jpg`       | WRONG_DIRECTION                                      | Wax seal with shield, R, laurel — heritage bank.                                                             |
| `assets/b/invite_001.jpg`     | STRONG (visually) but WRONG_DIRECTION                | Cream paper, oxblood border, oxblood wax seal — exactly the brief the user said to avoid.                    |
| `assets/c/hero_001.jpg`       | STRONG                                               | Cream envelope, hand-drawn monogram, fountain pen. The hand-drawn quality is the entire point.               |
| `assets/c/seal_001.jpg`       | STRONG (visually) but generic                        | A hand-drawn R in a wobbly circle; the form is right but the R is not a brand mark.                          |
| `assets/c/card_001.jpg`       | STRONG                                               | Hand-drawn card, fountain pen, warm wood.                                                                    |
| `assets/a/b/c/invite_001.jpg` | STRONG (forms)                                       | The form is the brief; the AI text is unreliable.                                                            |

### SVG seals (previous round)

| Asset                                                     | Verdict          | Note                                                                                                 |
| --------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `public/explorations/brand/seals/seal-a-modernist.svg`    | GENERIC          | Monoline circle, interlocked R/S, arc text. Reads as any institutional seal.                         |
| `public/explorations/brand/seals/seal-b-old-world.svg`    | WRONG_DIRECTION  | Rope-twist, oxblood centre, leaf RS. The heritage-society register.                                  |
| `public/explorations/brand/seals/seal-c-quiet-modern.svg` | USEFUL_REFERENCE | Hand-drawn R, wobbly circle. The hand-drawn quality survives, but the brand mark concept is generic. |

The 3 SVG seals are kept for reference but **none is recommended
for production** in this round. The new worlds do not start from a
seal; the identity emerges from the world's artefact (calendar
cell, letter, wordmark, programme).

### ThreeUI (previous round)

| Asset                                     | Verdict          | Note                                                                                   |
| ----------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `src/components/SocietySeal.tsx`          | GENERIC          | No-op shell that imports the ThreeUI package without using it.                         |
| `src/components/ThreeUISealPrototype.tsx` | USEFUL_REFERENCE | Actually mounts the `EngravedCertificate`; useful verification that the package works. |

The ThreeUI prototype is useful as a _mount verification_ — it
proves the ThreeUI package installs and renders on the current
stack. It is not recommended for production in the form it is
in. The new worlds each propose a different ThreeUI use that
emerges from the world, not from the seal.

---

## 35+ name candidates

The full list is in `01-naming-r2.md`. The 41 candidates, organised
by the new emotional territory, are:

**Inherited survivors (5):** The Deferred Society, The Reserved
Society, The Standing Society, The Mailed Society, The Standing
Date (re-cast from "The Standing Invitation").

**New — belonging + plans + being expected (6):** Plans With You,
Plans For You, The Held Table, Held For You, The Always-Invited,
The Always List.

**New — being remembered + continuity (6):** Kept On File,
Membership Pending, The Standing Apology, Cordially, Yours,
Cordially, Cordially, Yours.

**New — cancellation + relief (6):** Better Plans (dropped on
collision), The Cancel Club, Plans On Hold, Quiet Plans, Soft
Plans, The Last-Minute Card.

**New — standing + status (3):** Your Standing, The Standing Order,
Good Standing (dropped on collision).

**New — mailbox + correspondence (4):** The Card Club, On The Post
(dropped on collision), In The Post, Next Post.

**New — social choreography (5):** Always Off, On Schedule, The
Calendar Club, Save The Date (dropped on collision), Standing Plans.

**New — single-word brand-mark (6):** Cordial (kept in "Cordially"),
Standing (kept in "The Standing Society"), Pending (kept in
"Membership Pending"), Kept, Off, Plans.

**New — slightly surreal / dry (4):** The Apology Society, The
Without Club, Plans With You (kept), You Were Invited (dropped
on collision).

**New — warm + personal (3):** The Kind Membership, The Doubly Sure,
The Returned-To.

Final candidate set: **41 names total** (5 inherited + 36 new).
**23 inherited names were dropped** for not surviving the
emotional reframe; the drop reasons are in `01-naming-r2.md` §2.

### 5-name shortlist

1. **The Reserved Society** (inherited) — the double meaning still
   works on emotional criteria. "Reserved" = _kept aside for you_ +
   _quiet_, and the product does both. The pun lands quietly.
2. **Plans With You** (new) — the product in three words. The brand
   is the verb. Short, contemporary, instantly legible. The
   cancellation is built into the name.
3. **The Always-Invited** (new) — you are always invited. The
   kindness is in the _always_. Warm, dry, slightly absurd.
4. **Cordially** (new) — single word, contemporary, warm, soft.
   Doubles as a typography-friendly mark.
5. **Membership Pending** (new) — a state that never resolves.
   Delightful.

### Recommendation (advisory only — not locked)

If the user wants the most contemporary and emotionally direct name
that does not lean on heritage: **Plans With You**.

If the user wants the most brand-flexible single word: **Cordially**.

If the user wants the warmest member-facing name: **The Always-Invited**.

If the user wants the most distinctive, slightly absurd name:
**Membership Pending**.

If the user wants the name that the previous round's heritage
exploration would have locked: **The Reserved Society**, but with
the explicit decision to _not_ attach the heritage aesthetic to it.

The user decides.

### SEO and collision check (high-level, not legal)

This is creative and SEO research only. The user must do formal
clearance before locking.

Names that survive the rough filter:

- The Reserved Society (long-tail winnable)
- The Standing Society (long-tail winnable)
- The Standing Date (financial-term echo; brand-strategy review)
- The Held Table (low competition; winnable on "The Held Table
  club / membership / social")
- The Always-Invited (low competition; clean long tail)
- The Standing Apology (low competition; dry humour; brand-strategy
  review)
- Cordially (single word; brand-strategy review)
- Plans With You (low competition; clean long tail)
- The Calendar Club (low competition; risk of reading as SaaS)
- The Apology Society (low competition; dry humour)
- Membership Pending (generic phrase; long tail only)

Names dropped on collision grounds:

- Better Plans (too common)
- You Were Invited (film/event collision)
- Good Standing (bank/club collision)
- On The Post (children's TV collision)
- Save The Date (standard phrase)

Names needing brand-strategy review before lock:

- The Reserved Society (fashion-adjacent "Reserved" brand)
- The Standing Society (historical political-faction echo)
- Cordially (common signoff; depends on typography)
- The Cancel Club (meme risk)

---

## WORLD 1 · On Schedule

- **Concept:** the calendar is the artefact. Cancellation is the
  design. Contemporary editorial register, ink on cream, single
  orange accent. No seal. Recurring graphic device: a calendar cell
  with a state indicator.
- **Emotional rationale:** this is the only world that makes the
  _strange mechanics_ of the product a positive design asset. The
  cancellation is a _feature_, not a bug, and the visual system
  says so.
- **Typography:** Inter or GT America heavy for display; Inter
  regular for body; JetBrains Mono for small caps, dates, member
  numbers. Single family, ~30-40 KB critical path.
- **Colour:** `--ink #111111`, `--paper #F5F2EA`, `--paper-2 #E8E3D2`,
  `--ink-soft #3A3A3A`, `--rule #222222`, `--signal #FF5A1F`
  (cancelled/orange), `--dim #9A9A9A`. AAA on ink-on-paper.
- **Identity:** no seal, no monogram, no crest. The identity is a
  recurring graphic device — a calendar cell with a state. The
  wordmark is the identity. The orange dot is the brand mark.
- **Web:** editorial hero (a single large calendar cell), the
  cancelled-event counter as a real-time number, the invitation
  and cancellation as a 2-up pair on the same page.
- **Communications:** every email carries the same calendar cell
  with a state. Cancellation is the same form as the invitation,
  with the date struck through.
- **Physical:** matte cream stock, no emboss, no foil-stamp. The
  paper and the typography do the work. Card is a single calendar
  cell with the member's number as the date.
- **ThreeUI:** one island — a 3D calendar cell with a 5° tilt on
  hover. Static SVG fallback. No parallax, no particles, no shader.
- **OG / social:** wide negative space, single orange dot
  centred, real typography in SVG-rendered JPG.
- **Copy:** the proposition is "Plans were made. Plans were
  unmade." The CTA is "Add your name to the list." The cancellation
  reads as the design, not as a service failure.
- **Asset paths:**
  - `public/explorations/brand/r2-assets/w1/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg`
- **Emotional scorecard (1-5):** WANTED 4, INCLUDED 5, REMEMBERED
  4, SOCIALLY BUSY 5, CARED FOR 3, RELIEVED 5, CONTEMPORARY 5,
  MEMORABLE 4, BELIEVABLE 3, DESIRABLE 4. **Total: 42 / 50.**

---

## WORLD 2 · In The Post

- **Concept:** the mailbox is the emotional centre. Warm paper on
  warm wood, hand-written marks, sage + brick accents. The artefact
  is the letter.
- **Emotional rationale:** the warmest of the four worlds. The
  brand feels personal, almost small-business, in a way the others
  do not.
- **Typography:** Fraunces OFL (the only OFL stack of the four
  worlds) with SOFT axis on. IBM Plex Mono. Caveat (OFL) for
  handwritten signoffs.
- **Colour:** `--ink #1B1A17`, `--paper #F4EBD8`, `--paper-2
#E6D8BC`, `--sage #7A8C6B`, `--brick #A8503B`, `--ink-soft
#5A544A`. AAA on ink-on-paper.
- **Identity:** a small hand-drawn mark at the top of every
  artefact. The wordmark in Fraunces 600 sentence case. The
  mark is _the same flourish the operator draws in the corner of
  a letter_.
- **Web:** warm hero (a single cream envelope on warm wood), a
  hand-set pricing table (not a SaaS pricing table), the
  invitation and the cancellation as a hand-set pair.
- **Communications:** hand-written feel. The operator's signature
  on every email.
- **Physical:** envelope with a hand-drawn mark in the corner;
  letter with a typewriter-style dateline and a Fraunces italic
  body; card, certificate, gift packaging all in warm paper.
- **ThreeUI:** one island — a 3D embossed paper card with a 1.5 s
  slow tilt. Static SVG fallback.
- **OG / social:** wide warm composition, the envelope on warm
  wood with strong window light, real typography in SVG-rendered
  JPG.
- **Copy:** the proposition is "A small thing arrived today." The
  CTA is "Add your name to the list." The cancellation is gentle
  — the letter is the medium, not the cancellation mark.
- **Asset paths:**
  - `public/explorations/brand/r2-assets/w2/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg`
- **Emotional scorecard (1-5):** WANTED 4, INCLUDED 4, REMEMBERED
  5, SOCIALLY BUSY 3, CARED FOR 5, RELIEVED 3, CONTEMPORARY 4,
  MEMORABLE 4, BELIEVABLE 5, DESIRABLE 4. **Total: 41 / 50.**

---

## WORLD 3 · Cordially

- **Concept:** single-word brand mark, contemporary, slightly
  surprising. The wordmark is the identity. Off-white paper,
  vermilion red, confident type. The artefact is the type.
- **Emotional rationale:** the most contemporary and the most
  brand-flexible of the four worlds. A single-word brand mark
  survives across mediums better than a multi-word name.
- **Typography:** GT Sectra (paid) or Newsreader (OFL) for
  display. The same family for body. IBM Plex Mono.
- **Colour:** `--ink #0E0E0E`, `--paper #FAFAF7`, `--ink-soft
#3A3A3A`, `--rule #1A1A1A`, `--signal #E83A2E` (vermilion red),
  `--dim #9A9A9A`. AAA on ink-on-paper.
- **Identity:** "Cordially" set in the display face, in `--ink`
  on `--paper`, with a single small dot (·) before or after. No
  seal, no monogram, no crest. The mark is the word.
- **Web:** hero is the wordmark at very large size, with a
  short one-line proposition underneath. Wide negative space.
- **Communications:** every email and every letter closes with
  "Cordially," followed by the operator's name. The cancellation
  is the same form as the invitation.
- **Physical:** off-white stock; the wordmark at the top of
  every artefact; the small dot is the only accent.
- **ThreeUI:** one island — a 3D pulsing dot in `--signal` that
  pulses once on first reveal. Static SVG fallback.
- **OG / social:** the wordmark at very large size, centred or
  off-axis, in `--ink` on `--paper`. Real typography in
  SVG-rendered JPG.
- **Copy:** the proposition is "Cordially." The CTA is "Add your
  name to the list." The cancellation is the same form as the
  invitation.
- **Asset paths:**
  - `public/explorations/brand/r2-assets/w3/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg`
- **Emotional scorecard (1-5):** WANTED 3, INCLUDED 4, REMEMBERED
  3, SOCIALLY BUSY 4, CARED FOR 3, RELIEVED 4, CONTEMPORARY 5,
  MEMORABLE 5, BELIEVABLE 4, DESIRABLE 5. **Total: 40 / 50.**

---

## WORLD 4 · A Small Programme

- **Concept:** the invitation is a play programme. The
  cancellation is a curtain-down beat. Warm cream, oxblood red,
  contemporary small-theatre register. Slightly absurd.
- **Emotional rationale:** the world that is _most_ about the
  social choreography. The product manufactures social plans and
  then cancels them; in this world, the cancellation is a
  _curtain call_ — a small, absurdist, theatrical moment.
- **Typography:** Cormorant Garamond (OFL) or GT Sectra (paid)
  for display. Source Serif 4 (OFL) for body. IBM Plex Mono. The
  italic display treatment is reserved for "CANCELLED" — the
  same italic that the design system uses for act breaks in a
  play programme.
- **Colour:** `--ink #0E0B08`, `--paper #F2EAD8`, `--paper-2
#E6D9B8`, `--oxblood #5C1A1B`, `--ink-soft #3A2F22`. AAA on
  ink-on-paper.
- **Identity:** a small mark that suggests a closed curtain or a
  small stage, set in `--ink` on `--paper`. The wordmark in the
  display face. The mark is small enough to fit in the
  top-left corner of a programme.
- **Web:** hero is a single programme, slightly off-axis, with
  the wordmark in the centre, a date stamp in mono small caps at
  the top, and a single "TONIGHT" or "CANCELLED" mark in
  oxblood italic at the bottom.
- **Communications:** every email is a programme. The cancellation
  is the same programme with the `CANCELLED` stamp in oxblood
  italic at the bottom.
- **Physical:** cream stock; the curtain mark in the top-left;
  the wordmark in the centre. The certificate is a programme.
- **ThreeUI:** one island — a 3D paper programme with a 5° tilt
  on hover and a 1 s soft flip on click-to-reveal. Static SVG
  fallback.
- **OG / social:** a single programme, slightly off-axis, with
  the wordmark in the display face at the centre and the curtain
  mark in the top-left.
- **Copy:** the proposition is "A small programme for a small
  evening." The cancellation reads as a curtain-down beat, not
  as a service failure.
- **Asset paths:**
  - `public/explorations/brand/r2-assets/w4/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg`
- **Emotional scorecard (1-5):** WANTED 4, INCLUDED 4, REMEMBERED
  4, SOCIALLY BUSY 5, CARED FOR 3, RELIEVED 5, CONTEMPORARY 4,
  MEMORABLE 5, BELIEVABLE 4, DESIRABLE 4. **Total: 42 / 50.**

---

## SIDE-BY-SIDE COMPARISON

| Axis                 | W1 On Schedule         | W2 In The Post             | W3 Cordially                 | W4 A Small Programme           |
| -------------------- | ---------------------- | -------------------------- | ---------------------------- | ------------------------------ |
| **Primary artefact** | Calendar cell          | Letter / envelope          | The wordmark                 | Programme                      |
| **Tone**             | Contemporary editorial | Warm, soft, human          | Confident, contemporary      | Theatrical, slightly absurd    |
| **Display type**     | Inter / GT America     | Fraunces (soft serif)      | GT Sectra / Newsreader       | Cormorant Garamond / GT Sectra |
| **Single accent**    | Cancelled orange       | Sage + brick               | Vermilion red                | Oxblood                        |
| **Identity**         | Cell + wordmark        | Hand-drawn mark + wordmark | The wordmark is the mark     | Curtain mark + wordmark        |
| **ThreeUI**          | 3D cell with tilt      | 3D embossed card           | 3D pulsing dot               | 3D paper programme (flip)      |
| **Risk**             | Reads as SaaS          | Reads as small bookshop    | Reads as a single-word brand | Reads as a theatre company     |
| **WANTED**           | 4                      | 4                          | 3                            | 4                              |
| **INCLUDED**         | 5                      | 4                          | 4                            | 4                              |
| **REMEMBERED**       | 4                      | 5                          | 3                            | 4                              |
| **SOCIALLY BUSY**    | 5                      | 3                          | 4                            | 5                              |
| **CARED FOR**        | 3                      | 5                          | 3                            | 3                              |
| **RELIEVED**         | 5                      | 3                          | 4                            | 5                              |
| **CONTEMPORARY**     | 5                      | 4                          | 5                            | 4                              |
| **MEMORABLE**        | 4                      | 4                          | 5                            | 5                              |
| **BELIEVABLE**       | 3                      | 5                          | 4                            | 4                              |
| **DESIRABLE**        | 4                      | 4                          | 5                            | 4                              |
| **Total (of 50)**    | **42**                 | **41**                     | **40**                       | **42**                         |

---

## Previous recommendation re-evaluation

The previous round recommended **The Reserved Society + Modernist
Institution**. The user has correctly identified that the
_combination_ over-weighted heritage-society aesthetics, and that
"heritage" was not intrinsic to the product.

Honest re-evaluation:

- **The Reserved Society** (the name): survives on its own. The
  double meaning — _kept aside for you_ and _quiet_ — fits the
  product. The pun lands quietly. The name does not need the
  heritage aesthetic attached to it.
- **Modernist Institution** (the visual direction): the
  _calendar-mechanics_ part of the brief is exactly right (the
  orange dot, the cell with a state). The _heritage_
  _institution_ part is wrong. World 1 in this round is the
  same calendar-mechanics idea without the heritage weight.
  World 1 also wins the emotional scorecard at 42/50.

The previous combination is **not** the recommended combination
anymore. The new recommendation is below.

---

## Best untouched direction

- **World 1 (On Schedule)** is the most balanced and the most
  _contemporary_ direction. It wins on REMEMBERED, SOCIALLY BUSY,
  RELIEVED, CONTEMPORARY. It is the only world that makes the
  strange mechanics of the product a positive design asset.
  Score: 42/50.
- **World 4 (A Small Programme)** ties World 1 on score but is
  the most _distinctive_ and the most _memorable_. It wins on
  RELIEVED, MEMORABLE, and is the only world that uses the social
  choreography as the unit of design. Score: 42/50.

Both are excellent. The user picks by taste:

- **World 1** if the user wants contemporary editorial that does
  not collapse into "a theatre" or "a bookshop".
- **World 4** if the user wants the most distinctive and the most
  _culturally-aware_ direction.

---

## Best carefully combined direction, if applicable

There is one hybrid that the user should consider seriously:

**World 1 (On Schedule) + World 4 (A Small Programme) — the calendar

- the programme.**

The combination takes World 1's _calendar cell_ as the recurring
graphic device and World 4's _theatre programme_ as the cover
artefact. The card, the certificate, the gift, the OG are all
programmes; the cell-with-state is the recurring device _inside_
the programme; the cancellation is a programme with a `CANCELLED`
stamp in oxblood italic.

This is a real combination, not "best bits of everything". It
combines:

- the calendar-mechanics idea from World 1;
- the social-choreography idea from World 4;
- the cancelled-event-counter as a theatrical number (not just an
  editorial one);
- the orange dot as the recurring state indicator (with oxblood as
  the secondary accent for the _cancellation_ specifically).

It does **not** combine:

- World 2's warm paper (the hybrid is clean-cream, not warm-paper);
- World 3's single-word wordmark (the hybrid has a full wordmark,
  not a single word);
- the heritage-society register of the previous round.

This hybrid is **only** recommended if the user is choosing between
World 1 and World 4 and cannot decide. If the user can decide, the
user should pick one world, not the hybrid.

---

## Final recommendation

**Name:** _Plans With You._

**World:** _World 1 — On Schedule._

**Why this combination, in plain language:**

"Plans With You" is the most contemporary, the most emotionally
direct, and the least heritage-coded of the five shortlisted names.
It is the product in three words. It survives the emotional
reframe and it does not lean on any institutional register.

World 1 (On Schedule) is the most contemporary and the most
_emotionally balanced_ of the four worlds. The recurring graphic
device is a calendar cell with a state indicator (orange dot) and
the cancellation is the same form as the invitation. The
cancelled-event counter is the brand proof. The visual register
is contemporary editorial — not heritage, not a theatre, not a
bookshop. The score is 42/50 and it is the most balanced
distribution of the four worlds (no axis below 3).

This combination says to a prospective member: "I see you. You
are on the list. Plans are made. Plans are unmade. The Society
does not need you to do anything about it." The visual system
makes that promise concrete: every page is a calendar cell, every
event is a state, every cancellation is the same form as the
invitation. The orange dot is the brand.

**If the user wants the most distinctive direction** rather than
the most balanced: _Plans With You + World 4 (A Small Programme)_.
The score ties at 42/50 and the social-choreography idea is the
most distinctive emotional angle in the round.

**If the user wants the warmest direction**: *The Always-Invited

- World 2 (In The Post)*. The mailbox is the emotional centre.

**If the user wants the most brand-flexible single word**: *Cordially

- World 3*. The single-word mark survives across mediums, and the
  visual system is the wordmark and the dot.

**If the user wants the previous round's name without the heritage
weight**: _The Reserved Society + World 1_. The name survives, the
visual register is contemporary, and the heritage aesthetic is
explicitly not used.

The user decides.

### Risks

- **"Plans With You"** is short and contemporary but is also
  generic-phrase-adjacent. A user who searches "Plans With You
  club" may not find this first. Brand-strategy review before
  lock.
- **World 1 (On Schedule)** risks reading as a SaaS product if the
  visuals are too editorial. The orange dot must be deployed
  consistently and the cancelled-event counter must be visible on
  every page; without those anchors, the visual system can drift
  into "a contemporary art book".
- **No seal / no monogram / no crest** means the brand must
  survive on type and the recurring graphic device alone. A
  user who wants a strong mark-on-white-bg logo will not find
  one. This is a deliberate design choice, not an oversight.
- **ThreeUI usage is intentionally minimal** — one island per
  page, with a static SVG fallback. The visual system does not
  lean on 3D.
- **The previous round's 3 SVG seals are not recommended for
  production** in this round. The new worlds do not start from a
  seal. The previous seals are preserved as references but are
  not the recommended mark.

### Domain direction

The locked public URL is `https://club.loftwah.com` and that does
not change. The name is the _brand under that URL_, not a separate
domain. A dedicated domain is a Phase 3+ decision.

---

## Asset / contact-sheet paths

### Visual concepts (round 2)

```
public/explorations/brand/r2-assets/w1/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg
public/explorations/brand/r2-assets/w2/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg
public/explorations/brand/r2-assets/w3/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg
public/explorations/brand/r2-assets/w4/{hero,invite,cancel,card,birthday,package,og,supporting}_001.jpg
```

### Mirrored in the source tree

```
explorations/brand/r2-assets/w1/...
explorations/brand/r2-assets/w2/...
explorations/brand/r2-assets/w3/...
explorations/brand/r2-assets/w4/...
```

### Contact-sheet page

```
/brand-r2/
```

The page is excluded from the public sitemap and not indexed. It
shows all four worlds side by side, plus hero-compare and og-compare
grids for direct visual comparison.

### Previous round assets (preserved as reference)

```
explorations/brand/assets/{a,b,c}/...
public/explorations/brand/assets/{a,b,c}/...
public/explorations/brand/seals/{seal-a-modernist,seal-b-old-world,seal-c-quiet-modern}.svg
```

These are **not** the recommended production assets. They are the
previous round's hypothesis, retained for honest comparison.

### Documentation

```
explorations/brand/docs/01-naming-r2.md            # 41 candidate names, 5 shortlisted
explorations/brand/docs/08-worlds-overview.md       # 4 worlds, full spec
explorations/brand/docs/09-DECISION-PACKAGE-R2.md  # this document
explorations/brand/01-naming.md                     # previous round (preserved)
explorations/brand/02-shortlist.md                  # previous round (preserved)
explorations/brand/03-direction-a-modernist-institution.md   # previous round (preserved)
explorations/brand/04-direction-b-old-world-society.md       # previous round (preserved)
explorations/brand/05-direction-c-quiet-modern.md            # previous round (preserved)
explorations/brand/06-threeui-evaluation.md         # previous round ThreeUI review
explorations/brand/07-og-social-system.md           # previous round OG/social system
explorations/brand/00-DECISION_PACKAGE.md           # previous round decision package
explorations/brand/ASSET_INVENTORY.md               # previous round asset assessment
explorations/brand/PROVENANCE.md                    # previous round generation provenance
explorations/brand/INDEX.md                         # directory index
```

---

## Acceptance

```text
$ mise run acceptance
… 12/12 gates green …
ACCEPTANCE: PASS
```

The new explorations live entirely in `explorations/brand/r2-assets/`,
`public/explorations/brand/r2-assets/`, `src/pages/brand-r2.astro`,
and the new docs. No production code path was changed. The previous
brand-explorer page is preserved as a previous-round reference.

The 12 acceptance gates:

1. format:check
2. lint
3. typecheck (astro check)
4. typecheck (tsc)
5. unit tests
6. integration tests
7. static schema check
8. production build
9. copy client assets
10. wrangler config validation (dry-run)
11. real Cloudflare local D1 fresh-migration proof
12. browser E2E (Playwright)

All pass.

---

## Decisions requiring user

The user owns every one of these. Nothing in Phase 2 is silently
locked.

1. **Final club name** — top recommendation: _Plans With You_;
   fallbacks: _Cordially_, _The Always-Invited_, _Membership
   Pending_, _The Reserved Society_ (without the heritage
   aesthetic).
2. **Final brand direction** — top recommendation: _World 1 (On
   Schedule)_; with optional _World 4 (A Small Programme)_
   materials if the user wants more social-choreography weight.
3. **Final palette** — palette in the chosen world doc is the
   recommended palette; user approves or adjusts.
4. **Final fonts** — recommended face and OFL fallback specified
   per world; user approves.
5. **Identity system** — no seal, no monogram, no crest in the
   new worlds. The identity is the recurring graphic device
   (calendar cell, letter mark, wordmark + dot, programme mark)
   - the wordmark. User approves this design choice or asks for
     a mark.
6. **ThreeUI** — one island per world, with static SVG fallback.
   User approves.
7. **Final tagline** — none of the worlds is locked to a tagline.
   The candidate from `docs/03_BRAND_NAMING_COPY_SEO.md` §4.11
   is "You belong. You are invited. You are remembered. You do
   not have to show up." The world-specific hero copy is in each
   world's spec. User owns the lock.
8. **What to do with the previous round** — the previous
   recommendation, the 3 SVG seals, the 24 JPGs, and the
   `brand-explorer.astro` page are preserved. The user can ask to
   delete them, archive them, or keep them as reference.
9. **Hybrid vs single world** — if the user is choosing between
   World 1 and World 4, the §"Best carefully combined direction"
   hybrid is available. The user can pick the hybrid, one world,
   or a different combination.

Phase 3 work begins when the user locks a name + a world. Phase 3
is **explicitly not started** in this session.
