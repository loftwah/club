# Brand Direction C — "Quiet Modern"

A working title; this is a visual system, not a tagline.

The brand feels like a _small literary quarterly_ that has been
quietly reissued by a private correspondence club. The aesthetic
is warm, soft, restrained. The joke lives in the warmth, not in
the severity. The page reads at the pace of a printed journal.

This is the most _contemporary_ of the three directions and the
softest in register. It is the direction that most resembles a
bookshop you would walk into and not buy anything in.

## Working name used for mock-ups

**The Reserved Society** (advisory only — not locked).

The wordmark in this direction is a soft contemporary serif at
generous size, with the running line set in a quiet monospace.

## Positioning

> A small correspondence institution, run like a journal.
> Warm, restrained, a little melancholic. The page is the
> medium.

The visual logic comes from:

- the cover system of small independent literary quarterlies
  (_The Believer_, _Granta_'s softer years, _The Offing_);
- the typographic register of a long-form essay website that
  takes itself seriously (Editions at Large, The Paris Review
  Daily, long-form Substacks with editorial discipline);
- the dust-jacket aesthetic of a Penguin Classics reissue;
- the editorial discipline of a museum of small things
  (Letterform Archive, The Center for Fiction).

The Society is _a bookshop that writes to you_.

## Typography

### Display (wordmark, hero headings)

- **Primary candidate**: **Fraunces** (Undercase Type). A
  contemporary display serif with optical-size axes; a
  _soft_ serif that reads as a 21st-century editorial
  display face.
- **Open-source fallback**: **Newsreader** (Production
  Type, OFL on Google Fonts) at 600 weight. The fallback
  is honest and well-suited.
- **Reserved pairing**: **GT Super** (Grilli Type) for
  hero headings if the user wants a more squared display.

### Body (running text, UI)

- **Primary candidate**: **Fraunces** at 400, optical
  size 14, with the SOFT axis turned on. The same family
  as the display, so the page reads as a single voice.
- Body size 18px on desktop, 17px on mobile, line-height
  1.7. The body is _slightly larger and looser_ than the
  other two directions.

### Mono (numbers, monogram, footer micro-text)

- **Primary candidate**: **JetBrains Mono** or **IBM Plex
  Mono**. The mono is a quiet utility, not a feature.

### Web performance

- Fraunces is OFL and self-hostable as a single variable
  font. The full variable font is ~150 KB woff2; the
  critical-weight subset is ~22 KB woff2. This is the
  _only_ font that the page downloads as a variable, and
  the rest of the system is system-fonts only.
- Newsreader is OFL.
- JetBrains Mono is OFL.

### Licensing

- The whole stack is OFL. This direction is the _cheapest_
  to ship and the _fastest_ to deploy. There is no paid-font
  blocker.

## Palette

A six-token warm-paper system. This direction has the most
_colour_ in the page, and the warmest one.

| Token          | Hex       | Use                                 |
| -------------- | --------- | ----------------------------------- |
| `--ink`        | `#1B1A17` | primary text on paper               |
| `--paper`      | `#F6F0E2` | primary background (warm off-white) |
| `--paper-deep` | `#ECE3CE` | secondary surface, card backs       |
| `--dust`       | `#C9B998` | tertiary surface, faint band        |
| `--sage`       | `#7A8C6B` | primary accent (muted green)        |
| `--brick`      | `#A8503B` | secondary accent (muted brick)      |
| `--ink-soft`   | `#5A544A` | secondary text on paper             |

Accessible contrast on `--paper`:

- `--ink` on `--paper`: 14.3:1 — passes AAA.
- `--ink-soft` on `--paper`: 7.2:1 — passes AAA.
- `--sage` on `--paper`: 3.6:1 — passes AA for large text
  only; reserved for tags, large CTAs, and signal dots.
- `--brick` on `--paper`: 4.5:1 — passes AA for large text;
  reserved for accents and links.

Print-friendly:

- All tokens are CMYK-safe on uncoated warm-white stock.
- The brand is designed to be reproduced on cream paper
  with one or two spot inks.

## Logo / crest

### Wordmark

- The word **Reserved** set in Fraunces, in
  sentence-case italic, at 64-pt. No small caps, no
  tracking. The wordmark looks like the title of a
  short story.
- A small mono small-caps running line above and below:
  `THE … SOCIETY`.

### Monogram

- A monogram in the form of a _single hand-drawn_ R,
  drawn in a 2-pt `--ink` line on `--paper`. The R is
  slightly imperfect, slightly off-axis, and looks like
  it was drawn with a fountain pen. The monogram is
  rendered as SVG and as a ThreeUI engraved-card scene.

### Seal

- A circular monoline seal. A 1-pt `--ink` rule
  border. Inside, top arc: `THE RESERVED SOCIETY` in
  mono small caps. Inside, bottom arc: a small
  ornamental flourish — three dots, or a tiny
  hand-drawn line. Centre: the monogram.
- The seal is intentionally _not engraved_; it is
  _drawn_. This is the strongest difference between
  this direction and Direction B.

### Emblem logic

- The mark is a _hand-written_ mark, not an
  _engraved_ one. It is the mark of a small
  correspondence institution, not a private bank.

## Stationery

### Letterhead

- A4 / US Letter, warm off-white stock. Top-left:
  the wordmark in Fraunces italic 32-pt. Below the
  wordmark, a thin 0.5-pt `--ink` hairline. Body in
  Fraunces 11/16. Footer in JetBrains Mono 8-pt
  small caps. No centre alignment; the letterhead
  reads as a left-aligned manuscript page.

### Envelope

- DL or C5. Warm paper, no wax seal. A small
  printed seal in `--ink` on the back flap. The
  recipient address is hand-set in Fraunces
  italic; the sender address is in JetBrains
  Mono.

### Membership card

- 85.6 × 53.98 mm (CR80). Warm paper stock, single
  spot ink in `--ink`. Front: a hand-drawn R in
  the top-left, the wordmark in Fraunces italic
  centred, "MEMBER" in JetBrains Mono 8-pt small
  caps, name and member number in JetBrains Mono.
  Back: a short printed sentence in Fraunces
  italic — _This card identifies the bearer as
  a member in good standing. Both are optional._

### Certificate (engraved)

- A4 portrait, warm paper. A 0.5-pt `--ink` rule
  frame. The seal in the top-centre, the body in
  Fraunces italic 12/18, the recipient name and
  date set in Fraunces italic 28-pt. A blank space
  for a hand signature. A blind emboss of the
  seal in the bottom-right.

### Birthday card

- A6, warm paper. Front: a single hand-drawn
  R, slightly off-centre. Inside: a short
  paragraph in Fraunces italic.

### Event invitation

- A5, warm paper. The masthead is the wordmark
  in Fraunces italic. The date is in Fraunces
  italic 36pt. The body is in Fraunces italic
  11/16. The seal is in the bottom-right
  corner, drawn in `--ink`.

### Cancellation notice

- A5, warm paper. The masthead, the seal, and
  the paper are _identical_ to the invitation.
  Only the date, the heading, and the body
  change. The heading is set in Fraunces italic
  with the _same_ line breaks as the invitation,
  so the two documents read as a single
  correspondence pair.

## Physical artefacts

### Pen

- A wooden pen, turned from a single piece of
  figured walnut, with a brass nib unit. The pen
  is _warm to the touch_. Issued at the
  1-year milestone.

### Pin

- A 12-mm circular wooden pin, hand-finished.
  The face carries the monogram in
  `--ink`-coloured paint. The pin is a quiet
  identifier.

### Medallion

- A 35-mm wooden medallion, hand-finished, with
  the seal drawn in `--ink` paint on the front
  and the member number written in Fraunces
  italic on the back. Issued at the 3-year
  milestone.

### Seal / sticker

- A 40-mm circular paper sticker. Warm-paper
  face, single `--ink` ring, hand-drawn
  monogram centre. Used to close welcome-pack
  envelopes and as a small desk object for
  A$50 members.

### Anniversary object

- A small hand-bound notebook, 100 × 140 mm,
  with a warm-paper cover and a hand-drawn
  seal on the front. The end-papers are
  patterned in the same dust tone as the
  palette. Given at the 5-year milestone.

## Imagery

### Photographic style

- Warm, soft, late-afternoon light. A single
  human subject per frame, often with their
  attention elsewhere — looking out of a
  window, reading, holding a cup. The aesthetic
  is closer to _The Paris Review Daily_ than
  to _Aesop_.

### Generated illustration style

- A 2-pt hand-drawn line on warm paper, in
  `--ink`. The drawings are intentionally a
  little imperfect — a slight wobble in a
  circle, a slight off-axis stem. The aesthetic
  is the end-paper of a Penguin Classics
  reissue.

### Archival style

- Sepia-toned reproductions of fictional
  Society ephemera on warm paper, with
  paper-creases and small ink-spots. Always
  clearly labelled as fictional Society
  content.

### Fictional member portrait style

- A 2-pt hand-drawn line drawing on warm
  paper, in three-quarter profile, often
  with a small object in the foreground.
  The portrait is _of a type_, not _of a
  person_.

### Event art style

- A small hand-drawn scene — a doorway, a
  reading room, a kettled table — drawn in
  the same 2-pt line as the illustration
  system. The drawings are quiet, slightly
  off-axis, and never symmetrical.

## Motion / ThreeUI

ThreeUI is used in this direction for **one** thing: the
membership card as a _soft embossed_ object.

- A static SVG fallback shows the card as a flat
  warm-paper rectangle with a hand-drawn R.
- The ThreeUI island replaces the SVG with an
  embossed paper card scene when:
  - JS is enabled;
  - the user has not requested reduced motion;
  - the viewport is not a low-end mobile GPU.

The card animates a 1.5-second slow tilt on
first reveal, then goes still. No parallax. No
particles. No shader effects. The ThreeUI scene
is a single warm-paper card with a hand-drawn R
in low relief.

We do **not** use ThreeUI for:

- hero background animation;
- letterpress rolls on text;
- parallax sections;
- particle systems on hover.

## Mobile

- The membership card (if mounted) is replaced
  by a static SVG card on phones below 600px
  viewport width.
- The wordmark scales to the viewport but
  never below 32-pt or above 64-pt.
- No hover, no parallax, no pointer-only
  affordances.

## Copy samples

### Hero

> **The Reserved Society**
> A small correspondence institution, run like
> a journal. You are not expected to attend.

### Waiting-list CTA

> Add your name to the list.

### Invitation

> _14 November, half-past seven._
> The reading room, chapter Melbourne. Two of
> the other members. A small, ordinary
> evening. Dress is whatever you were going to
> wear.

### Cancellation

> _14 November, half-past seven — cancelled._
> The reading room is dark and the kettle is
> off. We will write again in the spring.

### Birthday

> _On the occasion of your birthday._
> A small card is in the post. The Society does
> not require a reply.

### Lore

> _Founded in the year of the second
> consecutive cancellation._ The Reserved
> Society began as a private list of names
> kept beside an empty table at a now-closed
> restaurant in the inner suburbs. The
> restaurant has been gone for a long time.
> The list is the institution.
