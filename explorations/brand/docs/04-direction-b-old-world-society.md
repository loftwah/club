# Brand Direction B — "Old-World Society"

A working title; this is a visual system, not a tagline.

The brand feels like a _private members' institution_ that has
existed since the late nineteenth century, that has a brass
plate on a closed door, and that prefers to write to you. The
aesthetic is engraved metal, deep pigment, and cream paper. The
humour lives in the contrast between the _severity_ of the
materials and the _absurdity_ of the proposition.

This is the most institutional of the three directions.

## Working name used for mock-ups

**The Reserved Society** (advisory only — not locked).

The wordmark in this direction is a high-contrast Roman display
serif, all small caps, with engraved metal as the dominant
material.

## Positioning

> A late-Victorian learned society, kept up to date. Engraved
> metal, cream paper, deep pigment. The door is closed by
> design.

The visual logic comes from:

- the typographic register of late-19th / early-20th-century
  British learned societies (Royal Society, Royal Academy,
  Royal Geographical Society — heritage editions, not modern
  rebrand attempts);
- the cover system of academic quarterlies (Mind, The
  Proceedings of the Aristotelian Society);
- the foil-stamp aesthetic of a private bank or a London
  club;
- the printed ephemera of a Catholic mission press, a
  private observatory, or a university printery.

The Society is _old money_ — the kind of institution that
prints its name in metal.

## Typography

### Display (wordmark, hero headings)

- **Primary candidate**: **GT Sectra** (Grilli Type). A
  high-contrast modern serif with a slight stress; in
  small caps at large size it reads as engraved.
- **Open-source fallback**: **Cormorant Garamond** (Google
  Fonts) — a free display Garamond with very high contrast.
  The fallback is honest; it does not look cheap.
- **Reserved pairing**: **Tiempos Headline** (Klim Type),
  if the user wants a more contemporary editorial voice.

### Body (running text, UI)

- **Primary candidate**: **Source Serif 4** (Adobe) or
  **GT Sectra Display**'s text weight.
- Body size 17px on desktop, 16px on mobile, line-height 1.65.
- Slightly tighter than the modern direction; this direction
  reads more like a printed page.

### Mono (numbers, monogram, footer micro-text)

- **Primary candidate**: **IBM Plex Mono** — the right
  amount of warmth for the period; reads as a typographer's
  working tool.

### Web performance

- GT Sectra is a paid licence. Until approved, fall back to
  Cormorant Garamond (OFL, ~38 KB woff2 for the display
  weights we need).
- Source Serif 4 is OFL — install freely.
- IBM Plex Mono is OFL — install freely.

### Licensing

- All three primary candidates are paid. The fallback pair
  (Cormorant Garamond + Source Serif 4 + IBM Plex Mono) is
  entirely OFL and would be a clean production setup.

## Palette

A six-token system with deep pigment and cream paper. This
direction uses colour more confidently than A.

| Token          | Hex       | Use                           |
| -------------- | --------- | ----------------------------- |
| `--ink`        | `#0E0B08` | primary text, fine engraving  |
| `--paper`      | `#F2EAD8` | primary background (cream)    |
| `--paper-deep` | `#E6D9B8` | secondary surface, card backs |
| `--oxblood`    | `#5C1A1B` | primary accent, deep red      |
| `--forest`     | `#1F3A2E` | secondary accent, deep green  |
| `--brass`      | `#A4833A` | metallic accent, highlights   |
| `--ink-soft`   | `#3A2F22` | secondary text on paper       |

Accessible contrast on `--paper`:

- `--ink` on `--paper`: 15.6:1 — passes AAA.
- `--ink-soft` on `--paper`: 10.1:1 — passes AAA.
- `--oxblood` on `--paper`: 7.8:1 — passes AAA.
- `--forest` on `--paper`: 9.0:1 — passes AAA.
- `--brass` on `--paper`: 3.2:1 — passes AA for large text
  only; the brass is reserved for metallic effects, foil
  stamps, and never used for body copy.

Print-friendly:

- `--oxblood` is a real CMYK pigment (PMS 490 close).
- `--brass` is intended to be a foil-stamp on physical
  artefacts; on screen it is a colour, not a metallic
  effect.

## Logo / crest

### Wordmark

- The word **RESERVED** set in GT Sectra Display, all small
  caps, generous tracking, in `--ink` on `--paper`.
- A small ornament — three engraved dots, or a thin
  hairline — sits between the two words.
- The wordmark reads as if it were cut into a brass plate.

### Monogram

- A monogram of interlocked **R** and **S**, drawn in a
  high-contrast engraved style. The R carries a small
  crown-like leaf ornament at its terminal; the S sits
  inside the R's bowl. The monogram is rendered as SVG
  and as a ThreeUI engraved-brass scene.

### Seal

- A circular wax-seal-style emblem with a rope-twist
  outer border. Inner ring: `THE RESERVED SOCIETY` set
  on the curve, with two small stars separating the
  words. Centre: the monogram. Below the monogram, a
  small engraved Roman date: `EST · MMXXVI`.
- The seal exists as an SVG and as a ThreeUI engraved
  scene (see ThreeUI section below).

### Emblem logic

- The seal is a _real_ seal in the heraldic sense: a
  single circular emblem that is recognisable at any
  size and is reproducible in wax, foil, and engraved
  metal.
- The seal **must not** carry founding text that names
  a real place, a real person, or a real partnership.

## Stationery

### Letterhead

- A4 / US Letter, cream stock. Top-centre: a small
  engraved seal in `--ink` (no colour). Below the
  seal, the wordmark. A 0.5-pt `--ink` hairline under
  the masthead. Body in Source Serif 4 11/16. Footer
  in IBM Plex Mono 7-pt small caps.

### Envelope

- DL or C5. Cream paper, deep-red wax seal in the
  centre of the flap. The wax seal is the only
  branded element. Recipient address in IBM Plex Mono.

### Membership card

- 85.6 × 53.98 mm (CR80). Cream stock, foil-stamped
  brass monogram. A thin engraved `--oxblood` border
  2 mm in from the edge. Front: monogram + wordmark +
  "MEMBER" + name + member number in IBM Plex Mono.
  Back: same engraved border + the same
  "presentation is optional" instruction as in
  Direction A.

### Certificate (engraved)

- A3 (larger than A4 — a real certificate). Cream
  stock. The seal is centred top. A 1-pt engraved
  border 1.5 cm in from the edge. The body is set
  in GT Sectra Display small caps. The recipient
  name is hand-set in 36pt. A blank space at the
  bottom-left for a hand signature. A blind
  emboss of the seal in the bottom-right.

### Birthday card

- A6, cream stock. Front: a single blind-embossed
  seal. Inside: a short hand-set paragraph in GT
  Sectra Display italic.

### Event invitation

- A5, cream stock, deep-oxblood ink. The masthead
  is engraved in `--ink`. The date is in GT Sectra
  Display 36pt small caps. The body is in Source
  Serif 4 11/16. The seal is a foil-stamp in
  `--brass` in the bottom-right corner.

### Cancellation notice

- A5, cream stock. The masthead, the seal, and the
  paper are _identical_ to the invitation. Only the
  date, the heading, and the body change. A small
  engraved border surrounds the heading. The
  sign-off is in Source Serif 4 italic.

## Physical artefacts

### Pen

- A heavy brass fountain pen, unbranded, with a deep
  oxblood grip section. The pen is a _tool_ that
  also looks like a Society artefact. Issued at
  the 1-year milestone.

### Pin

- A 15-mm brass pin. The front is an engraved
  monogram on a circular field; the back has a
  single butterfly clutch. The pin is a quiet
  identifier, not a badge of rank.

### Medallion

- A 40-mm brass medallion, polished face, with the
  seal pressed in relief on the front and the
  member number engraved on the back. Issued at
  the 3-year milestone.

### Seal / sticker

- A 45-mm circular wax-stamp. The wax is
  oxblood-coloured. The impression is the
  monogram, not the full seal. Used to close
  welcome-pack envelopes and as a small desk
  object for A$50 members.

### Anniversary object

- A brass letter-opener, 200 mm, with the seal
  engraved at the base of the handle. Given at
  the 5-year milestone.

## Imagery

### Photographic style

- Painterly documentary. Warm midtones, real light
  (often low or directional), cream-paper-soft
  contrast. A single human subject per frame,
  usually from the side or the back, often with
  an object from the Society in the foreground.
  The aesthetic is closer to _The New York Review
  of Books_ portrait photography than to
  _Aesop_.

### Generated illustration style

- Engraved. A 1-pt cross-hatched line on cream
  paper, in `--ink` only. The aesthetic is the
  end-paper of a 19th-century volume.

### Archival style

- Sepia-toned reproductions of fictional Society
  ephemera — agendas, receipt slips, internal
  memos — on cream paper, with cream-paper
  foxing and cream-paper creases. Always
  clearly labelled as fictional Society content.

### Fictional member portrait style

- Engraved, not photographed. A 1-pt line
  drawing of a person in three-quarter
  profile, on cream paper. The portrait is
  _of a type_, not _of a person_.

### Event art style

- Engraved. A small scene (a doorway, a
  reading room, a kettled table) drawn in
  the same 1-pt cross-hatched style as the
  illustration system.

## Motion / ThreeUI

ThreeUI is used in this direction for **two** things:

1. The seal as an engraved brass plate (the same
   idea as Direction A, but rendered as polished
   brass with a deep-oxblood engraved pattern).
2. The medallion as a slowly rotating 3D object
   on the membership page — the medallion is
   _the_ ThreeUI object in the brand, because it
   is the most material object in the artefact
   system.

The medallion rotates 8° on scroll, 360° on
click-to-reveal, and goes still on first
idle. The seal animates identically to Direction A.

We do **not** use ThreeUI for:

- hero text or letterpress rolls;
- parallax sections;
- any effect that pretends to be the
  _production_ artefact (the medallion on screen
  is a _representation_, never passed off as the
  real object).

## Mobile

- The medallion (if mounted) is replaced by a
  static SVG medallion on phones below 600px
  viewport width. The 3D version is a desktop
  and tablet flourish.
- The seal scales to the viewport but never below
  220px or above 320px square.
- No hover, no parallax, no pointer-only
  affordances.

## Copy samples

### Hero

> **The Reserved Society.**
> Founded in the year of the second consecutive
> cancellation. A private institution for members
> who are not expected to attend.

### Waiting-list CTA

> Submit your name to the waiting list.

### Invitation

> _The Society requests the pleasure of your company_
> 14 November, half-past seven
> The reading room, chapter Melbourne
> A small, ordinary evening, with two of the other
> members. Dress is whatever you were going to wear.

### Cancellation

> _The Society regrets_
> 14 November, half-past seven — Cancelled.
> The reading room is dark and the kettle is off.
> We shall write again in the spring.

### Birthday

> _On the occasion of your birthday_
> A small card is in the post. The Society does
> not require a reply, a phone call, or any other
> evidence of your continued membership.

### Lore

> _Founded in the year of the second consecutive
> cancellation._ The Reserved Society began as a
> private list of names kept beside an empty table
> at a now-closed restaurant in the inner suburbs.
> The restaurant has been gone for a long time.
> The list is the institution.
