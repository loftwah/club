# Brand Direction A — "Modernist Institution"

A working title; this is a visual system, not a tagline.

The brand feels like a _Swiss museum catalogue_ that has been quietly
reissued by a private members' institution. It is restrained, almost
clinical in its cleanliness, and then quietly serious. The joke, when
it lands, lands through the contrast between the cool typographic
register and the warm, slightly absurd content of the Society.

This direction treats the Society as a serious institution first
and a membership club second.

## Working name used for mock-ups

**The Reserved Society** (advisory only — not locked).

The wordmark in this direction sets "RESERVED" in a tight, slightly
extended grotesque and "THE … SOCIETY" in a smaller spaced sans as
a running line above and below.

## Positioning

> A contemporary learned society. Mid-century editorial rigour.
> No ornament that does not earn its place.

The visual logic comes from:

- mid-century Swiss editorial design (Lohse, Ruder, Müller-Brockmann);
- the cover system of serious quarterlies (The Yale Review, The
  New York Review of Books, Granta's more austere years);
- the typographic discipline of a private bank or a museum identity;
- the negative-space logic of Japanese museum catalogues.

The Society is _old money in modern dress_ — not flashy, not
minimalist-as-Apple, but minimalist-as-a-foundry.

## Typography

### Display (wordmark, hero headings)

- **Primary candidate**: **Söhne** (Klim Type Foundry). Tight,
  slightly extended grotesque with a humanist undertone; serious
  without being cold.
- **Open-source fallback** if licensing is not approved:
  **Inter** (Google Fonts) at extra-bold weight, optical-sized to
  the largest reading. Inter at 800 with -2% tracking is a
  serviceable stand-in.
- **Reserved pairing**: **GT America** (Grilli Type) for headings
  if a more squared, slightly more institutional grotesque is wanted.

### Body (running text, UI)

- **Primary candidate**: **Söhne Buch** or **Inter Regular**.
- Body size 17px on desktop, 16px on mobile, line-height 1.6.

### Mono (numbers, monogram, footer micro-text)

- **Primary candidate**: **GT America Mono** or **JetBrains Mono**.
- Used for member numbers (`№ 04821`), small caps, foundation
  dates (`EST. MMXXVI`).

### Web performance

- All three fallback choices are self-hostable as variable fonts.
- Inter as a single variable subset is roughly 28 KB woff2
  uncompressed; with the right preloads it adds under 20 KB to
  the critical path. The site already has working CSS and a
  small JS budget; this is acceptable.

### Licensing

- **Söhne** is a paid Klim licence. We do not install it until
  the user approves. Until then, use Inter.
- **Inter** is OFL — install freely.
- **JetBrains Mono** is OFL — install freely.

## Palette

A tight five-token system. The brand is mostly monochrome with a
single working colour.

| Token          | Hex       | Use                               |
| -------------- | --------- | --------------------------------- |
| `--ink`        | `#0F1115` | background, primary text on light |
| `--paper`      | `#F4F1EA` | primary background                |
| `--paper-deep` | `#EAE4D6` | secondary surface, card backs     |
| `--ink-soft`   | `#3A3F47` | secondary text, captions          |
| `--rule`       | `#1B1E23` | hairlines, borders, monogram      |
| `--signal`     | `#C8462C` | single working accent (vermilion) |

Accessible contrast on `--paper`:

- `--ink` on `--paper`: 14.8:1 — passes AAA.
- `--ink-soft` on `--paper`: 9.4:1 — passes AAA.
- `--signal` on `--paper`: 4.6:1 — passes AA for large text;
  the accent is reserved for large elements (CTA, signal dot,
  tag) and never used for body copy.

Print-friendly:

- All tokens are CMYK-safe; the `--signal` vermilion prints
  cleanly on uncoated stock.

## Logo / crest

### Wordmark

- The word **RESERVED** set in Söhne Breit, very tight tracking,
  set in `--ink` on `--paper`.
- Above the wordmark, in spaced mono small caps: `THE`.
- Below the wordmark, in spaced mono small caps: `SOCIETY`.
- Tracking on the running line is wide (0.4em) so the eye reads
  it as a frame, not a sentence.

### Monogram

- A monogram in the form of an interlocked **R** and **S**, set
  inside a thin 1px-rule circle. The monogram lives as a
  `data-uri` SVG for use in the favicon, the page corner, and
  the corner of the membership card.

### Seal

- A circular seal with a 1px-rule border. Inside, top arc:
  `THE RESERVED SOCIETY`. Bottom arc: `EST · MMXXVI` (or whatever
  year the user approves). Centre: the RS monogram, no
  additional ornament. The seal exists as an SVG and as a
  ThreeUI engraved-plate scene (see ThreeUI section below).

### Emblem logic

- The mark is a system, not a single asset. The same circle +
  monogram scales from a 16-px favicon to a 1.2-m medallion
  without losing identity.
- The seal **must not** carry founding text that names a real
  place, a real person, or a real partnership. It is a
  Society, not a company.

## Stationery

### Letterhead

- A4 / US Letter. Top-left: monogram. Top-right: wordmark +
  running line. A 0.5pt `--rule` hairline under the masthead.
- Body in Söhne Buch 10/14. Letter address set in mono
  small caps.
- Footer: 6-pt mono small caps, _Reserved Society · chapter
  identifier · member-number range this letter belongs to_.

### Envelope

- DL or C5. Monogram top-left, recipient address centred
  low, sender address small in mono bottom-left.
- No return envelope. The correspondence is one-way on the
  outside, two-way only by reply.

### Membership card

- 85.6 × 53.98 mm (CR80, ID-1). Matte off-white stock with
  a single spot-ink vermilion monogram in the corner.
- Front: monogram + wordmark + "MEMBER" + name + member number.
- Back: a quiet instruction: _"This card identifies the bearer
  as a member in good standing of the Society. Presentation
  is optional. So is attendance."_

### Certificate (engraved)

- A4 portrait. A 0.5pt rule frame, the seal in the top-centre,
  the body in a long-form Söhne Buch paragraph, the recipient
  name and date set in the same mono small caps used in the
  letterhead. A blank space at the bottom-left for a hand
  signature in the physical fulfilment.

### Birthday card

- A6. Front: a single signal-vermilion _RES·SD_ monogram on
  paper. Inside: a short hand-set paragraph in Söhne Buch.
  No illustration.

### Event invitation

- A5. The same masthead as the letterhead. A large date in
  Söhne Breit at the top. The body in Söhne Buch 11/15.
  The seal in the bottom-right corner. A single 0.5pt rule
  under the date.

### Cancellation notice

- A5. Same paper. The seal and masthead are _unchanged_ from
  the invitation — the cancellation is the same document
  type, which is the point. Only the headline changes:
  a small mono small-caps `CANCELLATION` tag, the date and
  event name set in Söhne Buch italic, a single quiet
  sentence explaining, and a "warmly, the Society"
  sign-off in mono.

## Physical artefacts

### Pen

- A 0.7-mm mechanical pencil-style ink pen in matte black
  aluminium. The body is unbranded. A thin vermilion ring
  near the grip is the only mark. The pen is a _tool_, not
  a souvenir.

### Pin

- A 12-mm circular cloisonné pin. The circle is
  paper-coloured; the centre carries the RS monogram in
  `--ink` with a `--signal` dot in the middle of the R.

### Medallion

- A 35-mm brass medallion, brushed finish, with the seal
  pressed in relief on the front and the member number
  engraved on the back. Issued at the 1-year milestone.

### Seal / sticker

- A 40-mm circular wax-sticker. Paper-coloured face, ink
  ring, signal-vermilion monogram centre. The sticker seals
  the welcome-pack envelope and is also given to A$50
  members as a desk object.

### Anniversary object

- A small brass paperweight, 60 × 40 mm, with the seal
  embossed in the centre and the member number on the
  underside. Given at the 5-year milestone.

## Imagery

### Photographic style

- Editorial documentary. Mid-grey midtones. Real
  chapter locations. Real light, mostly natural. A single
  human subject per frame, often shown from behind or
  off-centre. No posed smiles. The aesthetic is closer
  to _Granta_ than to _Aesop_.

### Generated illustration style

- Minimal. When illustration is needed, it is a single
  line drawing on `--paper`, drawn in `--ink`, in a
  consistent 1.5-pt stroke. No fill, no gradient, no
  shadow.

### Archival style

- Black-and-white reproductions of fictional Society
  ephemera — meeting agendas that were never held,
  cancelled-engagement notices, internal memos. The
  aesthetic is a _Werner Söderström_ catalogue. Always
  clearly labelled as fictional Society content.

### Fictional member portrait style

- Cropped, desaturated, mostly from behind. The members
  we show are intentionally not-quite-anyone. They are
  Society members; they are not specific real people.

### Event art style

- Geometric. A circle, a date, a chapter name. No event
  illustration that does not work in two colours.

## Motion / ThreeUI

ThreeUI is used in this direction for **one** thing: the
seal as an engraved metal plate.

- A static SVG fallback shows the seal as a flat
  1-px-rule circle.
- The ThreeUI island replaces the SVG with an engraved
  brass-plate scene when:
  - JS is enabled;
  - the user has not requested reduced motion;
  - the viewport is not a low-end mobile GPU (we detect
    on capability rather than screen size).

The seal animates a 2.5-second slow rotation on
first reveal, then goes still. No parallax. No particles.
No shader effects. The ThreeUI scene is a single
brushed-metal disc with the engraved seal.

We do **not** use ThreeUI for:

- hero background animation;
- letterpress rolls on text;
- parallax sections;
- particle systems on hover.

A motion-based alternative for older devices is a 1-second
CSS reveal of the SVG.

## Mobile

- The hero seal scales to the viewport but never below
  220px or above 320px square.
- The wordmark stays on one line; if the viewport is
  below 360px, the running line (`THE … SOCIETY`) drops
  to a second line under the wordmark.
- No hover. No parallax. No pointer-cursor affordances
  that do not have a touch equivalent.
- Tap targets are 44px minimum.

## Copy samples

### Hero

> **The Reserved Society.**
> A real membership institution. You are kept on the list,
> written to in your own time, and not expected to attend.

### Waiting-list CTA

> Apply to the waiting list.

### Invitation

> 14 November, 7:30 pm
> The reading room, chapter Melbourne.
> A small, ordinary evening, with two of the other members.
> Dress is whatever you were going to wear.

### Cancellation

> 14 November, 7:30 pm — Cancelled.
> The reading room is dark and the kettle is off. We will
> write again in the spring.

### Birthday

> Happy birthday, R.
> A small card is in the post. The Society does not need
> you to do anything about it.

### Lore

> Founded in the year of the second consecutive cancellation,
> the Reserved Society began as a private list of names kept
> beside an empty table at a now-closed restaurant in the
> inner suburbs. The restaurant has been gone for a long time.
> The list is the institution.
