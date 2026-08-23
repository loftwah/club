# Phase 2 (Round 2) — Four Visual Worlds

> **Date:** 2026-08-23 (round 2)
> **Status:** Phase 2 · decision package (revised exploration)

The previous round produced three brand directions (A · Modernist
Institution, B · Old-World Society, C · Quiet Modern) that all
leaned on the same vocabulary: cream paper, a seal or seal-shaped
mark, brass or wax, stationery as the dominant artefact, and a
heritage register. The user has correctly identified that this
vocabulary is one possible ingredient — not the product.

This round defines **four genuinely different visual worlds** that
each start from the **customer experience** rather than from a logo.

The worlds are deliberately not logo-first. Each one is a complete
art-direction system for the website, communications, physical
experience, and OG/social. The identity mark (if any) emerges from
the world rather than the other way around.

The four worlds are:

1. **On Schedule** — leans into the strange social/calendar mechanics
   of the product. Contemporary editorial register. The artefact is
   the calendar.
2. **In The Post** — warm and human. The mailbox is the emotional
   centre. The artefact is the letter.
3. **Cordially** — single-word brand mark, contemporary, slightly
   surprising. The artefact is the type.
4. **A Small Programme** — leans into the social choreography. Warm,
   theatrical, slightly absurd. The artefact is the programme.

The 5-name shortlist is in `01-naming-r2.md`. Each world works with
more than one of the five shortlisted names; the names are a
separate decision.

---

## World 1 · On Schedule

### Concept

The product manufactures social plans and then cancels them. The
calendar is the artefact. The world treats the calendar — the
schedule, the planning, the cancellation mark, the rescheduled
state — as the primary design material.

The customer experience this world expresses:

- Your social calendar appears alive.
- You have plans involving you.
- The plans feel plausible.
- The date approaches.
- The club cancels it.
- The obligation eventually disappears.
- The relief of staying home without feeling unwanted or forgotten.

### Emotional rationale

This is the only world that makes the _strange mechanics_ of the
product a positive design asset. A reader who lands on the homepage
should think "oh, _of course_ the design language is the calendar —
that _is_ the product". The cancellation is a _feature_, not a
bug, and the visual system says so.

### Visual register

- Contemporary editorial (NYT Cooking, Linear, Are.na, _Apartamento_).
- Generous negative space, structured grid, clear typographic
  hierarchy.
- Slightly editorial in the way a contemporary newspaper
  publication is editorial, not the way a museum catalogue is
  editorial.
- No heritage, no wax, no brass, no monograms.

### Typography

- **Display (hero, page titles):** a contemporary grotesque —
  Inter at heavy weight, or a paid alternative (GT America,
  Söhne).
- **Body:** Inter regular, generous line-height (1.6).
- **Numerals:** tabular figures for dates and member numbers.
- **Mono (small caps, dates, member numbers):** JetBrains Mono.
- **Variable: a single family, mostly self-hosted, 30-40 KB
  total critical-path budget.**

### Colour

A tight, high-contrast system. The brand is mostly ink on cream,
with a single working accent.

| Token        | Hex       | Use                              |
| ------------ | --------- | -------------------------------- |
| `--ink`      | `#111111` | Background, primary text         |
| `--paper`    | `#F5F2EA` | Primary surface                  |
| `--paper-2`  | `#E8E3D2` | Secondary surface                |
| `--ink-soft` | `#3A3A3A` | Secondary text                   |
| `--rule`     | `#222222` | Hairlines, grid                  |
| `--signal`   | `#FF5A1F` | Single accent (cancelled/orange) |
| `--dim`      | `#9A9A9A` | Disabled / pending               |

Accessible contrast on `--paper`:

- `--ink` on `--paper`: **16.0:1** — AAA
- `--ink-soft` on `--paper`: **9.8:1** — AAA
- `--signal` on `--paper`: **3.4:1** — AA large text only; the
  signal is reserved for the cancellation mark, the active
  status, and the waitlist dot, not for body copy.
- `--dim` on `--paper`: **2.8:1** — used only for status metadata
  where it does not need to be readable.

Print-friendly: CMYK-safe. The signal orange prints on uncoated
stock without losing the "alert" feel.

### Identity

No seal. No monogram. No crest.

The identity is a **recurring graphic device**: a calendar cell
with a state. The cell is a 4:5 or 5:7 rectangle; it has a small
label, a date, and a state indicator. The state indicator can be
a tiny dot, a thin horizontal line, a strikethrough, or a single
word (`UPCOMING`, `CANCELLED`, `RESCHEDULED`, `PENDING`,
`MEMBER`).

The wordmark is set in Inter 800, very tight tracking, in
`--ink`. The running line is set in JetBrains Mono small caps.
The wordmark is the identity; there is no separate mark.

Favicon is a single calendar cell showing `00` or `··` in
`--signal` on `--ink`.

### Web (homepage, mobile, pricing, cancelled-event counter)

The homepage is a structured editorial page. The hero is a single
calendar cell at large size (a "next event" card), the cancelled-
event counter is a running number in tabular figures, and the
rest of the page reads as a contemporary long-form publication.

- **Hero:** a large calendar cell showing the next cancelled
  event, with the cancellation mark already applied. A
  short, dry, editorial headline.
- **Cancelled-event counter:** a single number, updated in real
  time, set in tabular figures. The number _is_ the brand proof.
- **Membership section:** three tiers, presented as a clear
  pricing table with a one-line value prop per tier.
- **Invitation / cancellation sequence:** shown as a 2-up pair
  (the invite and the cancel) on the same page, demonstrating
  the emotional arc.
- **Mobile:** the calendar cell scales; the cancellation
  counter stays in the same position on every page; the
  navigation is a single horizontal scroll at the top.

### Communications

- **Email header:** a single calendar cell with the date and
  state, in `--ink` on `--paper`.
- **Invitation email:** a calendar cell with `INVITED` in
  `--signal` mono caps; a short body in Inter regular.
- **Cancellation email:** the same calendar cell, with the
  date struck through and `CANCELLED` in `--signal` mono caps.
- **Birthday email:** the calendar cell shows the date in
  `--ink` with a small cake icon (or a single character
  decoration) in `--signal`.
- **Newsletter:** an editorial layout with a header that is
  just a date stamp.
- **Operator-like personal message:** a single body paragraph
  in Inter regular, with a `--dim` signoff that includes the
  operator's initials.

### Physical

- **Envelope:** white or cream DL, a single small printed
  calendar cell on the front flap. No return envelope.
- **Letter:** A4 on cream paper, monospace dateline at the
  top, Inter body, mono signoff. No letterhead logo; the
  wordmark is set in mono at the top-left.
- **Membership card:** CR80, matte cream stock. Front: the
  wordmark, the calendar cell with the member's number as
  the date, the member's name in Inter regular. Back: a
  quiet single-sentence instruction. The card is
  deliberately _not_ embossed or foil-stamped; the paper
  and the typography do the work.
- **Birthday card:** A6, cream stock. Front: a single
  calendar cell with the member's birthday date. Inside: a
  short paragraph in Inter regular.
- **Certificate:** A4, cream stock. A 0.5pt `--rule` frame,
  the wordmark at the top, the body in Inter regular, the
  recipient's name in Inter 600, a blank line for a hand
  signature, a small printed calendar cell in the
  bottom-right.
- **Gift packaging:** matte cream sleeve, the wordmark in
  mono on the front, the gift inside wrapped in unbleached
  paper with a single mono label.
- **Anniversary object:** a small printed-on-paper card, the
  same dimensions as the membership card, with a unique
  calendar cell for the anniversary year.

### ThreeUI

ThreeUI is used for **one** thing: the calendar cell as a
small object that can be _tilted_ on hover, so the user
feels the weight of the cell.

- A static SVG fallback shows the cell as a flat rectangle.
- The ThreeUI island replaces the SVG with a 3D extruded
  rectangle (the calendar cell) when:
  - JS is enabled;
  - `prefers-reduced-motion` is not set;
  - the GPU is not weak (capability test, not screen size).

The cell animates a 5° tilt on hover (no parallax, no
particles). On first reveal, the cell does a 0.4 s settle.

We do **not** use ThreeUI for: the wordmark, the
cancelled-event counter, the pricing table, the invitation
sequence, the footer, the navigation. None of those need 3D.

### OG / social

- **Default OG (1200×630):** a single large calendar cell
  showing `··` (a placeholder date) with the wordmark in
  the bottom-left. Wide negative space. Real typography.
- **Membership OG:** the membership card front, centred, on
  `--paper`.
- **How-it-works OG:** the invite + cancel 2-up pair at
  small size, in the centre of the OG canvas.
- **Chapter OG:** the chapter name set in mono small caps,
  with the chapter's "founding date" as a small mono
  numeral.
- **Journal OG:** the article title set in Inter 800 on
  `--paper`, with a single line in `--ink-soft` underneath.

### Copy samples (World 1)

_Hero:_

> **Plans were made. Plans were unmade.**
> A real membership institution. You are on the list, written to
> in your own time, and not expected to attend.

_Proposition:_

> You belong. You are invited. You are remembered. You do not have
> to show up.

_Waiting-list CTA:_

> Add your name to the list.

_Invitation:_

> 14 November, 7:30 pm. The reading room, chapter Melbourne. A
> small, ordinary evening with two of the other members. Dress is
> whatever you were going to wear.

_Cancellation:_

> 14 November, 7:30 pm — **cancelled**. The kettle is off. We will
> write again in the spring.

_Birthday:_

> Happy birthday. A card is in the post. The Society does not need
> you to do anything about it.

_Personal correspondence:_

> We noticed it has been a quiet few months. Nothing is required of
> you. A small thing is on its way in the post.

_Lore:_

> The Society began as a private list of names kept beside an empty
> table. The list is the institution.

### Emotional scorecard (World 1)

| Axis          | Score (1-5) | Note                                                        |
| ------------- | ----------- | ----------------------------------------------------------- |
| WANTED        | **4**       | The hero is literally a cancelled plan; you are inside it.  |
| INCLUDED      | **5**       | "You are on the list" is the design and the copy.           |
| REMEMBERED    | **4**       | The date in the calendar cell is the artefact.              |
| SOCIALLY BUSY | **5**       | The cancelled-event counter proves the social life.         |
| CARED FOR     | **3**       | Care is there, but expressed editorially, not warmly.       |
| RELIEVED      | **5**       | The cancellation is the design and the copy.                |
| CONTEMPORARY  | **5**       | Reads as 2026, not 1926.                                    |
| MEMORABLE     | **4**       | The calendar cell is distinctive; the wordmark is clean.    |
| BELIEVABLE    | **3**       | Reads as a real institution; could be slightly more human.  |
| DESIRABLE     | **4**       | The customer is treated as smart; the design respects them. |

---

## World 2 · In The Post

### Concept

The mailbox is the emotional centre. The artefact is the letter.
The world is warm, soft, paper-on-wood, hand-written; the design
language is the _act of receiving something_ in the post, not the
_fact_ of being on a list.

The customer experience this world expresses:

- Someone remembers me.
- Someone sends things specifically to me.
- My birthday matters.
- My membership has continuity.

### Emotional rationale

This is the warmest of the four worlds. It is the only world that
is unambiguously about the _physical mailbox_. The brand feels
personal, almost small-business, in a way that the other worlds
do not.

### Visual register

- Warm, soft, contemporary humanist.
- Reference vibe: a small literary press, a hand-bound publisher,
  a small bookshop that writes to you.
- Not heritage, not Victorian, not brass.
- Less editorial structure, more feeling.

### Typography

- **Display (hero, page titles):** a soft contemporary serif —
  Fraunces (OFL) at heavy weight, with the SOFT axis on, or
  GT Super (paid) for a more squared display.
- **Body:** Fraunces 400 with SOFT on, line-height 1.7.
- **Mono (small caps, dates, member numbers):** IBM Plex Mono.
- **Hand-written accent (used sparingly, in correspondence):**
  Caveat (OFL) for short signoffs and handwritten notes.
- **Variable: a single family (Fraunces) plus mono + handwriting
  is the full stack.**

### Colour

A warm-paper system. This world uses colour the most _softly_.

| Token         | Hex       | Use                            |
| ------------- | --------- | ------------------------------ |
| `--ink`       | `#1B1A17` | Primary text                   |
| `--paper`     | `#F4EBD8` | Primary surface (warm cream)   |
| `--paper-2`   | `#E6D8BC` | Secondary surface              |
| `--sage`      | `#7A8C6B` | Primary accent (muted green)   |
| `--brick`     | `#A8503B` | Secondary accent (muted brick) |
| `--ink-soft`  | `#5A544A` | Secondary text                 |
| `--ink-faint` | `#8A847A` | Tertiary text                  |

Accessible contrast on `--paper`:

- `--ink` on `--paper`: **14.0:1** — AAA
- `--ink-soft` on `--paper`: **7.1:1** — AAA
- `--sage` on `--paper`: **3.5:1** — AA large text only
- `--brick` on `--paper`: **4.4:1** — AA large text

Print-friendly: CMYK-safe. Prints on warm cream stock without
losing the warmth.

### Identity

The identity is a small hand-drawn mark — a single character
or a small flourish — that appears at the top of every page,
on every piece of correspondence, and on the membership card.
It is not a seal. It is _the same flourish the operator
draws in the corner of a letter_.

The wordmark is set in Fraunces 600 in sentence case. The
running line is set in IBM Plex Mono small caps.

Favicon is the small mark in `--ink` on `--paper`.

### Web

- **Hero:** a single warm-paper envelope, slightly off-axis, with
  a small hand-drawn mark in the corner. The hero copy is a
  short, warm paragraph.
- **Mobile hero:** the same envelope, scaled to the viewport.
- **Cancelled-event counter:** a single warm number set in
  Fraunces 600, in `--ink`, on `--paper`. The number is the
  brand proof.
- **Pricing:** a soft, hand-set table, not a SaaS pricing
  table. Each tier is a small note card, not a row.
- **Invitation / cancellation sequence:** shown as a hand-set
  pair, the invitation and the cancellation on the same page,
  both warm-paper, both with the same hand-drawn mark.
- **Member correspondence:** a real-feeling letter, with a
  signature, on the page.

### Communications

- **Email header:** a thin warm-paper band, with the hand-drawn
  mark in the top-left.
- **Invitation email:** a short hand-written note in Fraunces
  italic, with the date in IBM Plex Mono. The signature is a
  Caveat handwritten name.
- **Cancellation email:** a hand-written note in Fraunces
  italic. The cancellation is gentler in this world — the
  letter is the medium, not the cancellation mark.
- **Birthday email:** a hand-written "happy birthday" with a
  small hand-drawn mark.
- **Newsletter:** a long-form letter, sent from the operator,
  with the operator's handwritten signature at the bottom.
- **Operator-like personal message:** a Fraunces italic
  paragraph, with a Caveat handwritten signature.

### Physical

- **Envelope:** cream DL, the hand-drawn mark in
  `--ink-soft` in the top-left corner, the recipient address
  in IBM Plex Mono. A single small printed seal on the back
  flap.
- **Letter:** A4 on warm cream stock, with the hand-drawn
  mark at the top-left, a typewriter-style dateline in IBM
  Plex Mono, a Fraunces italic body, a Caveat handwritten
  signature.
- **Membership card:** CR80, warm paper, single spot ink in
  `--ink`. Front: the hand-drawn mark, the wordmark in
  Fraunces, "MEMBER" in IBM Plex Mono small caps, the
  member's name and number in IBM Plex Mono. Back: a
  short hand-written sentence in Fraunces italic.
- **Birthday card:** A6 warm paper. Front: a single
  hand-drawn mark. Inside: a hand-written "happy birthday"
  in Fraunces italic.
- **Certificate:** A4 warm paper. A 0.5pt `--ink` frame, the
  hand-drawn mark at the top-centre, a Fraunces italic body,
  a hand-written recipient name, a hand-written signature.
- **Gift packaging:** unbleached paper sleeve, the
  hand-drawn mark in `--ink` on the front, the gift inside
  wrapped in more warm paper with a mono label.
- **Anniversary object:** a hand-bound notebook, 100×140 mm,
  warm paper cover, the hand-drawn mark on the front, the
  end-papers patterned in the same `--sage` as the palette.

### ThreeUI

ThreeUI is used for **one** thing: the membership card as a
_soft embossed_ object.

- A static SVG fallback shows the card as a flat warm-paper
  rectangle.
- The ThreeUI island replaces the SVG with an embossed paper
  card scene when:
  - JS is enabled;
  - `prefers-reduced-motion` is not set;
  - the GPU is not weak.

The card animates a 1.5 s slow tilt on first reveal, then
goes still. No parallax, no particles, no shader effects.

We do **not** use ThreeUI for: the hero, the
cancelled-event counter, the pricing, the navigation, the
footer. None of those need 3D.

### OG / social

- **Default OG (1200×630):** a single warm-paper envelope
  with the hand-drawn mark in the top-left, the wordmark in
  the bottom-left. Real typography. Wide negative space.
- **Membership OG:** the membership card front, slightly
  off-axis, on warm paper.
- **How-it-works OG:** the invite + cancel pair, both
  warm-paper, on the same OG canvas.
- **Chapter OG:** a single paragraph of Fraunces italic with
  the chapter name in mono small caps.
- **Journal OG:** an article title in Fraunces 600 with a
  hand-drawn flourish underneath.

### Copy samples (World 2)

_Hero:_

> **A small thing arrived today.**
> The Reserved Society. A real membership institution. You are on
> the list, written to in your own time, and not expected to
> attend.

_Proposition:_

> You belong. You are invited. You are remembered. You do not
> have to show up.

_Waiting-list CTA:_

> Add your name to the list.

_Invitation:_

> _14 November, half-past seven._ The reading room, chapter
> Melbourne. A small, ordinary evening with two of the other
> members. Dress is whatever you were going to wear.

_Cancellation:_

> _14 November, half-past seven — cancelled._ The reading room
> is dark and the kettle is off. We will write again in the
> spring.

_Birthday:_

> _On the occasion of your birthday._ A small card is in the
> post. The Society does not require a reply.

_Personal correspondence:_

> We noticed it has been a quiet few months. Nothing is required
> of you. A small thing is on its way.

_Lore:_

> The Reserved Society began as a private list of names kept
> beside an empty table at a now-closed restaurant in the inner
> suburbs. The list is the institution.

### Emotional scorecard (World 2)

| Axis          | Score (1-5) | Note                                                                                          |
| ------------- | ----------- | --------------------------------------------------------------------------------------------- |
| WANTED        | **4**       | The hero is a "thing that arrived"; you are the recipient.                                    |
| INCLUDED      | **4**       | "You are on the list" survives in the copy.                                                   |
| REMEMBERED    | **5**       | The artefact is the letter; the design says "we wrote to you".                                |
| SOCIALLY BUSY | **3**       | The cancelled-event counter is there but the design language is the letter, not the calendar. |
| CARED FOR     | **5**       | Warm, personal, hand-written.                                                                 |
| RELIEVED      | **3**       | The cancellation is gentle, but the world is not built around the cancellation.               |
| CONTEMPORARY  | **4**       | Soft contemporary; could be mistaken for a small bookshop if the visuals are too quiet.       |
| MEMORABLE     | **4**       | The hand-drawn mark and the envelope are distinctive.                                         |
| BELIEVABLE    | **5**       | Reads as a real person writing to you.                                                        |
| DESIRABLE     | **4**       | The customer is treated as a friend, not a target.                                            |

---

## World 3 · Cordially

### Concept

Single-word brand mark, contemporary, slightly surprising. The
artefact is the _type_ itself. The design language is the
typography; the word "Cordially" is the brand, and every piece
of correspondence, every page, every artefact ends with the same
formality.

The customer experience this world expresses:

- I am a member of a real institution.
- The institution is contemporary.
- The institution is confident.
- The formality is the warmth.

### Emotional rationale

This is the most contemporary and the most brand-flexible of the
four worlds. A single-word brand mark survives across mediums
better than a multi-word name. "Cordially" is the brand, the
signoff, and the design language.

### Visual register

- Strong typographic, single-word brand-mark, contemporary,
  slightly editorial.
- Reference vibe: a contemporary type foundry, a confident
  cultural brand (Soho House newsletter, _The Drift_ magazine,
  a contemporary art book).
- Not heritage. Not Victorian. Not brass. Not wax.
- Confident, restrained, slightly surprising.

### Typography

- **Display (wordmark, hero, page titles):** a single family
  set at large size — GT Sectra (paid) or Newsreader (OFL) at
  heavy weight.
- **Body:** the same family at regular weight, generous
  line-height (1.65).
- **Mono (small caps, dates, member numbers):** IBM Plex Mono.
- **Variable: a single family plus mono is the full stack.**

### Colour

A two-tone system with a single strong accent. Confident,
restrained.

| Token        | Hex       | Use                           |
| ------------ | --------- | ----------------------------- |
| `--ink`      | `#0E0E0E` | Primary text                  |
| `--paper`    | `#FAFAF7` | Primary surface (off-white)   |
| `--ink-soft` | `#3A3A3A` | Secondary text                |
| `--rule`     | `#1A1A1A` | Hairlines, grid               |
| `--signal`   | `#E83A2E` | Single accent (vermilion-red) |
| `--dim`      | `#9A9A9A` | Tertiary text                 |

Accessible contrast on `--paper`:

- `--ink` on `--paper`: **18.4:1** — AAA
- `--ink-soft` on `--paper`: **9.4:1** — AAA
- `--signal` on `--paper`: **4.4:1** — AA large text
- `--dim` on `--paper`: **2.8:1** — non-text only

Print-friendly: CMYK-safe.

### Identity

The wordmark IS the identity. "Cordially" set in the display
face, in `--ink` on `--paper`, with a single small dot (·)
before or after. No seal. No monogram. No crest. The mark is
the word.

Favicon is a single dot in `--signal` on `--ink`.

### Web

- **Hero:** the wordmark "Cordially" set at very large size
  (clamp 64pt to 200pt) in the display face, with a short
  one-line proposition underneath in the same face at smaller
  size. Wide negative space.
- **Mobile hero:** the wordmark scales; the proposition stays.
- **Cancelled-event counter:** a single number set in the
  display face, in `--ink`, with the small dot before or
  after. The number _is_ the brand proof.
- **Pricing:** a clean three-row table, one tier per row.
- **Invitation / cancellation sequence:** shown as a 2-up
  pair (the invite and the cancel) on the same page, both
  with the wordmark, both in the same type.
- **Member correspondence:** a short, single-paragraph note
  ending with "Cordially,".

### Communications

- **Email header:** a single horizontal rule in `--rule`,
  with the wordmark "Cordially" in the display face at the
  left, the date in IBM Plex Mono at the right.
- **Invitation email:** the wordmark at the top, the date
  in IBM Plex Mono, the body in the display face regular.
  The closing is "Cordially," followed by the operator's
  name.
- **Cancellation email:** the wordmark at the top, the date
  struck through in `--signal`, the body in the display
  face. The closing is "Cordially," followed by the
  operator's name. The cancellation is _the same form_ as
  the invitation.
- **Birthday email:** the wordmark at the top, a single line
  "Happy birthday." in the display face, the member's name
  in IBM Plex Mono.
- **Newsletter:** an editorial layout with a header that
  is the wordmark and a thin rule.
- **Operator-like personal message:** a single short
  paragraph, signed "Cordially," followed by the operator's
  name.

### Physical

- **Envelope:** off-white DL, the wordmark in the top-left,
  the recipient address in IBM Plex Mono. A small printed
  dot in `--signal` on the back flap.
- **Letter:** A4 on off-white stock, the wordmark at the
  top-left, a IBM Plex Mono dateline, a body in the
  display face, a "Cordially," closing.
- **Membership card:** CR80, off-white stock. Front: the
  wordmark, "MEMBER" in IBM Plex Mono small caps, the
  member's name and number in IBM Plex Mono. Back: a
  single-sentence instruction.
- **Birthday card:** A6 off-white stock. Front: a single
  dot in `--signal` and the wordmark in `--ink`. Inside:
  "Happy birthday." in the display face.
- **Certificate:** A4 off-white stock. A 0.5pt `--rule`
  frame, the wordmark at the top, the body in the display
  face, the recipient's name, a hand-written signature.
- **Gift packaging:** off-white sleeve, the wordmark in
  mono on the front, the gift inside wrapped in unbleached
  paper with a small `--signal` dot label.
- **Anniversary object:** a printed-on-paper card, the same
  dimensions as the membership card, with the wordmark
  and a unique dot.

### ThreeUI

ThreeUI is used for **one** thing: the small dot in
`--signal` as a 3D object that _pulses once_ on first
reveal.

- A static SVG fallback shows the dot as a flat circle.
- The ThreeUI island replaces the SVG with a 3D sphere
  when:
  - JS is enabled;
  - `prefers-reduced-motion` is not set;
  - the GPU is not weak.

The sphere animates a 1 s slow pulse on first reveal,
then goes still. No parallax, no particles, no shader
effects.

We do **not** use ThreeUI for: the wordmark, the
cancelled-event counter, the pricing, the navigation, the
footer. None of those need 3D.

### OG / social

- **Default OG (1200×630):** the wordmark "Cordially" at
  very large size, centred or off-axis, in `--ink` on
  `--paper`. Real typography. Wide negative space.
- **Membership OG:** the membership card front, centred,
  on `--paper`.
- **How-it-works OG:** the invite + cancel 2-up pair at
  small size, in the centre of the OG canvas, both with
  the wordmark.
- **Chapter OG:** the chapter name set in the display
  face, with the wordmark in mono small caps underneath.
- **Journal OG:** an article title in the display face
  with a thin rule underneath.

### Copy samples (World 3)

_Hero:_

> **Cordially.**
> A real membership institution. You are on the list,
> written to in your own time, and not expected to attend.

_Proposition:_

> You belong. You are invited. You are remembered. You do
> not have to show up.

_Waiting-list CTA:_

> Add your name to the list.

_Invitation:_

> 14 November, 7:30 pm. The reading room, chapter
> Melbourne. A small, ordinary evening with two of the
> other members. Dress is whatever you were going to wear.

_Cancellation:_

> 14 November, 7:30 pm — _cancelled._ The kettle is off.
> We will write again in the spring.

_Birthday:_

> Happy birthday. A small card is in the post. The Society
> does not need you to do anything about it.

_Personal correspondence:_

> We noticed it has been a quiet few months. Nothing is
> required of you. A small thing is on its way.

_Lore:_

> The Reserved Society began as a private list of names
> kept beside an empty table at a now-closed restaurant
> in the inner suburbs. The list is the institution.

### Emotional scorecard (World 3)

| Axis          | Score (1-5) | Note                                                       |
| ------------- | ----------- | ---------------------------------------------------------- |
| WANTED        | **3**       | The formality is the warmth; the word is the welcome.      |
| INCLUDED      | **4**       | The list is the design.                                    |
| REMEMBERED    | **3**       | The closing "Cordially," is the artefact.                  |
| SOCIALLY BUSY | **4**       | The cancelled-event counter is editorial, confident.       |
| CARED FOR     | **3**       | Care is there, but expressed as confidence, not warmth.    |
| RELIEVED      | **4**       | The cancellation is the same form as the invitation;       |
|               |             | the relief is built into the consistency.                  |
| CONTEMPORARY  | **5**       | The most contemporary of the four worlds.                  |
| MEMORABLE     | **5**       | Single-word brand mark survives across mediums.            |
| BELIEVABLE    | **4**       | Reads as a real institution; could be slightly more human. |
| DESIRABLE     | **5**       | The customer is treated as a peer, not a target.           |

---

## World 4 · A Small Programme

### Concept

The invitation is a play programme. The cancellation is a
curtain-down moment. The social life is theatre. The world
treats the _invitation_ and the _cancellation_ as the same
artefact — a programme, posted, that announces and then
withdraws the same event.

The customer experience this world expresses:

- I have plans involving me.
- The plans feel plausible.
- The date approaches.
- The club cancels it.
- The cancellation is a small dramatic beat, not a service
  failure.
- The relief of staying home has its own little pleasure.

### Emotional rationale

This is the world that is _most_ about the social choreography.
The product manufactures social plans and then cancels them; in
this world, the cancellation is a _curtain call_ — a small,
absurdist, theatrical moment that the design language celebrates.
A reader who lands on the homepage should think "oh, the
invitation _is_ the programme, and the cancellation _is_ the
same programme with a stamp on it".

### Visual register

- Contemporary theatre programme, slightly editorial, slightly
  absurd.
- Reference vibe: a small independent theatre's programme (Toneelgroep,
  Punchdrunk, a Soho theatre, a contemporary dance company), a small
  independent cinema's flyer, a contemporary cultural venue.
- Not heritage. Not Victorian. Not brass. Not wax.
- Slightly theatrical, but not pretentious.

### Typography

- **Display (programme title, hero, page titles):** a contemporary
  humanist serif — Cormorant Garamond (OFL) or GT Sectra (paid).
- **Body:** Source Serif 4 (OFL) or GT Sectra (paid) text weight.
- **Mono (small caps, dates, member numbers):** IBM Plex Mono.
- **Theatrical accent (used sparingly):** an italic display
  treatment for "CANCELLED" — the same italic that the design
  system uses for the act breaks in a play programme.

### Colour

A warm-paper system with a single strong accent. The
colour is the colour of a small theatre programme: warm
cream, deep ink, a single bold accent.

| Token         | Hex       | Use                      |
| ------------- | --------- | ------------------------ |
| `--ink`       | `#0E0B08` | Primary text             |
| `--paper`     | `#F2EAD8` | Primary surface (cream)  |
| `--paper-2`   | `#E6D9B8` | Secondary surface        |
| `--oxblood`   | `#5C1A1B` | Single accent (deep red) |
| `--ink-soft`  | `#3A2F22` | Secondary text           |
| `--ink-faint` | `#7A6F5A` | Tertiary text            |

Accessible contrast on `--paper`:

- `--ink` on `--paper`: **15.6:1** — AAA
- `--ink-soft` on `--paper`: **10.1:1** — AAA
- `--oxblood` on `--paper`: **7.8:1** — AAA

Print-friendly: CMYK-safe. The oxblood is a real CMYK
pigment, prints on cream stock without losing its weight.

### Identity

The identity is a small mark that suggests a closed curtain or
a small stage. The mark is two simple curves that read as a
curtain, set in `--ink` on `--paper`. The mark is small
enough to fit in the top-left corner of a programme; the
wordmark is set in the display face in the centre of the
programme.

Favicon is the small curtain mark in `--ink` on `--paper`.

### Web

- **Hero:** a single programme, slightly off-axis, with the
  wordmark in the centre, a date stamp in mono small caps at
  the top, and a single "TONIGHT" or "CANCELLED" mark in
  oxblood italic at the bottom.
- **Mobile hero:** the programme scales; the mark stays.
- **Cancelled-event counter:** a single number in the display
  face, with the word "successfully cancelled" in IBM Plex
  Mono underneath. The number is the brand proof.
- **Pricing:** three rows, each a small programme-style note.
- **Invitation / cancellation sequence:** shown as a 2-up
  pair, the invite and the cancel, both programmes, the
  cancel with the `CANCELLED` stamp in oxblood italic.
- **Member correspondence:** a short letter in the same
  cream paper, signed in the same way as a programme
  colophon.

### Communications

- **Email header:** a single thin rule in `--rule`, the
  curtain mark in the top-left, the wordmark in the
  display face at the centre.
- **Invitation email:** the programme, full-width, with the
  date stamp at the top, the body in the body face, the
  `TONIGHT` mark at the bottom. The closing is the
  programme's colophon.
- **Cancellation email:** the same programme, with the
  `CANCELLED` stamp in oxblood italic at the bottom. The
  body changes; the form does not.
- **Birthday email:** the programme, with a "HAPPY BIRTHDAY"
  set in display italic at the bottom.
- **Newsletter:** an editorial layout with a header that is
  the curtain mark and the wordmark.
- **Operator-like personal message:** a single short
  paragraph, signed with the programme's colophon.

### Physical

- **Envelope:** cream DL, the curtain mark in `--ink-soft`
  in the top-left corner, the recipient address in IBM
  Plex Mono. A small printed seal on the back flap.
- **Letter:** A4 on cream stock, the curtain mark at the
  top-left, a mono dateline, a body in the body face, a
  programme-style colophon at the bottom.
- **Membership card:** CR80, cream stock. Front: the
  curtain mark, the wordmark in the display face,
  "MEMBER" in IBM Plex Mono small caps, the member's name
  and number in IBM Plex Mono. Back: a single-sentence
  instruction in italic.
- **Birthday card:** A6 cream stock. Front: a single
  curtain mark. Inside: "Happy birthday." in display
  italic.
- **Certificate:** A4 cream stock. A 0.5pt `--rule` frame,
  the curtain mark at the top, the wordmark in the display
  face, the body, the recipient's name, a hand-written
  signature.
- **Gift packaging:** cream sleeve, the curtain mark in
  `--ink` on the front, the gift inside wrapped in
  unbleached paper with a small oxblood label.
- **Anniversary object:** a printed programme, the same
  size as the invitation, with a unique date and a unique
  colophon.

### ThreeUI

ThreeUI is used for **one** thing: the programme as a
_soft 3D paper_ object that the user can _flip_.

- A static SVG fallback shows the programme as a flat
  cream rectangle.
- The ThreeUI island replaces the SVG with a 3D extruded
  paper programme when:
  - JS is enabled;
  - `prefers-reduced-motion` is not set;
  - the GPU is not weak.

The programme does a 5° tilt on hover, a 0° settle on
idle, and a 1 s soft flip on click-to-reveal. No
parallax, no particles, no shader effects.

We do **not** use ThreeUI for: the curtain mark, the
cancelled-event counter, the pricing, the navigation,
the footer.

### OG / social

- **Default OG (1200×630):** a single programme, slightly
  off-axis, with the wordmark in the display face at the
  centre, the curtain mark in the top-left, real
  typography.
- **Membership OG:** the membership card front, slightly
  off-axis, on cream paper.
- **How-it-works OG:** the invite + cancel 2-up pair, both
  programmes, on the same OG canvas.
- **Chapter OG:** a single programme for the chapter, with
  the chapter's "founding date" as a small mono numeral.
- **Journal OG:** an article title in display italic with
  a thin rule underneath, and a "PROGRAMME NOTE" prefix in
  IBM Plex Mono small caps.

### Copy samples (World 4)

_Hero:_

> **A small programme for a small evening.**
> The Reserved Society. A real membership institution. You are
> on the list, written to in your own time, and not expected to
> attend.

_Proposition:_

> You belong. You are invited. You are remembered. You do not
> have to show up.

_Waiting-list CTA:_

> Add your name to the list.

_Invitation:_

> 14 November, 7:30 pm. The reading room, chapter Melbourne. A
> small, ordinary evening with two of the other members. Dress
> is whatever you were going to wear.

_Cancellation:_

> 14 November, 7:30 pm — _cancelled._ The kettle is off. We
> will write again in the spring.

_Birthday:_

> Happy birthday. A small card is in the post. The Society
> does not need you to do anything about it.

_Personal correspondence:_

> We noticed it has been a quiet few months. Nothing is
> required of you. A small thing is on its way.

_Lore:_

> The Reserved Society began as a private list of names kept
> beside an empty table at a now-closed restaurant in the
> inner suburbs. The list is the institution.

### Emotional scorecard (World 4)

| Axis          | Score (1-5) | Note                                                            |
| ------------- | ----------- | --------------------------------------------------------------- |
| WANTED        | **4**       | The programme is the welcome.                                   |
| INCLUDED      | **4**       | "You are on the list" survives in the copy.                     |
| REMEMBERED    | **4**       | The cancellation is the same form as the invitation;            |
|               |             | the remember-and-cancel is the design.                          |
| SOCIALLY BUSY | **5**       | The cancelled-event counter is a _theatrical_ number.           |
| CARED FOR     | **3**       | Care is there but expressed theatrically, not warmly.           |
| RELIEVED      | **5**       | The cancellation is a curtain-down beat, not a service failure. |
| CONTEMPORARY  | **4**       | A small-theatre contemporary register; could be mistaken        |
|               |             | for a performing-arts venue.                                    |
| MEMORABLE     | **5**       | The programme as the unit of design is distinctive.             |
| BELIEVABLE    | **4**       | Reads as a real institution; the theatrical register might      |
|               |             | be too much for some.                                           |
| DESIRABLE     | **4**       | The customer is treated as an audience, not a target.           |

---

## Side-by-side comparison of the four worlds

| Axis                 | W1 · On Schedule           | W2 · In The Post             | W3 · Cordially               | W4 · A Small Programme         |
| -------------------- | -------------------------- | ---------------------------- | ---------------------------- | ------------------------------ |
| **Primary artefact** | Calendar cell              | Letter / envelope            | The wordmark                 | Programme                      |
| **Tone**             | Contemporary editorial     | Warm, soft, human            | Confident, contemporary      | Theatrical, slightly absurd    |
| **Display type**     | Inter / GT America (heavy) | Fraunces (soft serif)        | GT Sectra / Newsreader       | Cormorant Garamond / GT Sectra |
| **Single accent**    | Cancelled orange           | Sage green + brick           | Vermilion red                | Oxblood                        |
| **Identity**         | The cell + the wordmark    | A hand-drawn mark + wordmark | The wordmark is the mark     | A curtain mark + wordmark      |
| **ThreeUI**          | 3D cell with tilt          | 3D embossed card             | 3D pulsing dot               | 3D paper programme (flip)      |
| **Risk**             | Reads as SaaS / product    | Reads as small bookshop      | Reads as a single-word brand | Reads as a theatre company     |
| **WANTED**           | 4                          | 4                            | 3                            | 4                              |
| **INCLUDED**         | 5                          | 4                            | 4                            | 4                              |
| **REMEMBERED**       | 4                          | 5                            | 3                            | 4                              |
| **SOCIALLY BUSY**    | 5                          | 3                            | 4                            | 5                              |
| **CARED FOR**        | 3                          | 5                            | 3                            | 3                              |
| **RELIEVED**         | 5                          | 3                            | 4                            | 5                              |
| **CONTEMPORARY**     | 5                          | 4                            | 5                            | 4                              |
| **MEMORABLE**        | 4                          | 4                            | 5                            | 5                              |
| **BELIEVABLE**       | 3                          | 5                            | 4                            | 4                              |
| **DESIRABLE**        | 4                          | 4                            | 5                            | 4                              |
| **Total (of 50)**    | **42**                     | **41**                       | **40**                       | **42**                         |

Two worlds tie at 42. World 1 is the most balanced and the most
"contemporary" — it wins on REMEMBERED, SOCIALLY BUSY, RELIEVED,
CONTEMPORARY. World 4 is the most distinctive and the most
_memorable_ — it wins on RELIEVED, MEMORABLE, and is the only
world that uses the social choreography as the unit of design.

The previous round's recommended combination (The Reserved Society

- Modernist Institution) is the heritage-society version of
  World 1. The user has correctly identified that the heritage
  aesthetic is the wrong weight. World 1 _without_ the heritage
  weight — the same calendar-mechanics design with a different
  palette and type — is a different and stronger direction.

---

## Mapping names to worlds

The 5-name shortlist (from `01-naming-r2.md`) maps to the four
worlds like this:

| Name                 | W1 On Schedule | W2 In The Post | W3 Cordially   | W4 A Small Programme |
| -------------------- | -------------- | -------------- | -------------- | -------------------- |
| The Reserved Society | works (calm)   | works (warm)   | works (formal) | works (slightly off) |
| Plans With You       | **strong**     | works          | works          | **strong**           |
| The Always-Invited   | works          | **strong**     | works (formal) | works                |
| Cordially            | works          | works          | **strong**     | works                |
| Membership Pending   | **strong**     | works          | works (formal) | works                |

**Cordially** is the only name that _requires_ World 3 — a single-
word brand mark only works when the design system can carry the
weight. **The Reserved Society** is the most flexible; it works
across all four worlds with the right palette and type.

If the user locks Cordially as the name, World 3 is the natural
fit. If the user locks Plans With You, World 1 or World 4 is the
natural fit. If the user locks The Always-Invited, World 2 is the
natural fit. If the user locks The Reserved Society, the user
should pick the world that fits the emotional direction they
want, not the heritage aesthetic the previous round attached to
the name.
