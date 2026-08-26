---
name: Plans With You — Dispatch Wall
description: A contemporary membership system built from schedules, deliberate cancellation, and quiet belonging.
colors:
  paper: "#f5f1e7"
  paper-deep: "#e8e2d3"
  paper-light: "#fbf9f3"
  ink: "#12110f"
  ink-soft: "#4e4b44"
  ink-faint: "#69655d"
  signal: "#e94616"
  signal-text: "#b9340e"
  signal-soft: "#f7d9cc"
  calendar: "#2447ff"
  calendar-dark: "#1932be"
  success: "#126b3a"
  danger: "#a5261e"
typography:
  display:
    fontFamily: '"Archivo Variable", "Arial Narrow", sans-serif'
    fontSize: "clamp(3rem, 7vw, 5.8rem)"
    fontWeight: 680
    lineHeight: 0.95
    letterSpacing: "-0.045em"
  body:
    fontFamily: '"Archivo Variable", "Arial Narrow", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  letter:
    fontFamily: '"Source Serif 4 Variable", Georgia, serif'
    fontSize: "clamp(1.1rem, 1.7vw, 1.45rem)"
    fontWeight: 400
    lineHeight: 1.35
  data:
    fontFamily: '"Fragment Mono", monospace'
    fontSize: "0.68rem"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.08em"
rounded:
  square: "0"
  slight: "0.125rem"
  lifecycle: "0.45rem"
  pill: "999px"
spacing:
  hairline: "1px"
  gutter: "clamp(1rem, 3vw, 3rem)"
  section: "clamp(4.5rem, 10vw, 9rem)"
  md: "1rem"
  lg: "2rem"
  xl: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "white"
    rounded: "{rounded.square}"
    padding: "0.75rem 1rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.calendar}"
    textColor: "white"
    rounded: "{rounded.square}"
  button-signal:
    backgroundColor: "{colors.signal-text}"
    textColor: "white"
    rounded: "{rounded.square}"
    padding: "0.75rem 1rem"
    height: "3.25rem"
  button-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0.75rem 1rem"
  field:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0.75rem 0.85rem"
    height: "3.2rem"
  lifecycle-status:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.signal-text}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 0.85rem"
---

# Design System: Plans With You — Dispatch Wall

## Overview

**Creative North Star: “The Dispatch Wall”**

Plans With You treats contemporary scheduling and administrative objects as the
primary visual material. The calendar, docket, date, status, rail, and record
are not decoration: they make the product's unusual promise legible. The first
viewport is a living operations desk for plans that are made, anticipated, and
successfully unmade. Cool paper and near-black ink keep the system calm and
trustworthy; cobalt marks schedule logic; vermilion makes cancellation decisive.

Correspondence is the supporting material world. Source Serif passages, raised
paper, and a soft correspondence tint add human warmth below or beside the
schedule world without turning the product into an old-money club, law firm,
heritage society, or luxury template. Higher membership tiers become more
tangible through physical and human fulfilment, never more belonging.

The committed visual seed is `2a9e769e`. The independent finish review returned
the verdict `ship`; this file records the design system that is actually in the
shipped public routes and their final desktop/mobile captures.

**Key Characteristics:**

- Administrative objects first: docket, date, rail, barcode, public truth, and archive.
- Square-to-small-radius controls, hairlines, dashed separators, and restrained paper depth.
- Cancellation is a successful terminal outcome, represented with a clear vermilion intervention.
- Warm correspondence supports the contemporary schedule world; it never becomes heritage cosplay.
- Semantic HTML and real text carry the product; images, canvas, and motion are optional enhancement.

## Colors

The palette is warm schedule paper against near-black ink, with a cobalt system
signal and a vermilion cancellation signal. The bright signal is intentionally
graphic; its darker text-safe sibling carries ordinary-size text and white text.

### Primary

- **Calendar cobalt** (`{colors.calendar}`): Schedule headers, selected/current schedule marks, and the active progress language of a plan.
- **Text cobalt** (`{colors.calendar-dark}`): Links and cobalt text on paper where readable contrast is required.
- **Signal vermilion** (`{colors.signal}`): Large cancellation fields, status dots, hero emphasis, and other graphic interventions where dark ink is used.
- **Text vermilion** (`{colors.signal-text}`): Accessible cancellation copy, CTA variants, status text, and surfaces carrying white text.

### Neutral

- **Schedule paper** (`{colors.paper}`): The default canvas and the dominant public/member surface.
- **Raised paper** (`{colors.paper-light}`): Dispatch strips, letters, forms, lifecycle panels, and other surfaces that sit above the canvas.
- **Deep paper** (`{colors.paper-deep}`): Quiet-belonging fields and tonal separation without a generic card shadow.
- **Ink** (`{colors.ink}`): Primary text, rules, controls, footer, and high-contrast data.
- **Soft ink** (`{colors.ink-soft}`): Body copy and explanatory text.
- **Faint ink** (`{colors.ink-faint}`): Metadata and micro-copy on paper.
- **Success green** (`{colors.success}`): A terminal fulfilment/archival confirmation in lifecycle language.
- **Danger red** (`{colors.danger}`): Errors and failed operations; never use it to describe ordinary cancellation.

### Secondary

- **Correspondence blush** (`{colors.signal-soft}`): The supporting physical/post world, selected interest treatment, and soft warmth behind content—not a luxury wash.

### Named Rules

**The Signal Legibility Rule.** Bright vermilion is for large graphics or dark
ink. Use text vermilion when normal-size text or white text needs to sit on a
signal surface. Do not make a cancellation look like an error by substituting
the danger colour for the successful signal.

**The One Meaning Rule.** Cobalt means schedule/registration logic, vermilion
means cancellation or warmth, green means successful terminal fulfilment, and
red means an actual failure. Do not repurpose these signals for decoration.

## Typography

**Display Font:** Archivo Variable (with Arial Narrow and sans-serif fallbacks)

**Body Font:** Archivo Variable (with Arial Narrow and sans-serif fallbacks)

**Letter Font:** Source Serif 4 Variable (with Georgia fallback)

**Label/Mono Font:** Fragment Mono (with a monospace fallback)

Archivo supplies the direct, slightly compressed contemporary voice for
headlines, navigation, forms, and product interface. Source Serif 4 appears in
letters, explanatory passages, and moments of human warmth. Fragment Mono
treats dates, states, codes, and audit metadata as graphic material. All three
faces are self-hosted through Fontsource; there is no runtime font loader or
font CDN.

### Hierarchy

- **Display** (680, `clamp(3rem, 7vw, 5.8rem)`, `0.95`): Hero and section statements; homepage hero remains capped below 6rem.
- **Headline** (680, `clamp(2.2rem, 4vw, 4.2rem)`, `0.95`): Section titles, public-truth statements, and major explanatory anchors.
- **Title** (650–720, `clamp(1.35rem, 3vw, 3rem)`, `0.95–1.2`): Cards, tier names, navigation items, and lifecycle titles.
- **Body** (400, `1rem`, `1.5`): Default interface and explanatory copy; colour shifts to soft ink for supporting prose.
- **Letter** (400, `clamp(1.1rem, 1.7vw, 1.45rem)`, `1.3–1.5`): Human correspondence and longer proposition text.
- **Data** (400–700, `0.58–0.72rem`, `1.2–1.5`, `0.05–0.14em` tracking, uppercase): Dockets, date fields, state labels, codes, and compact status metadata.

### Named Rules

**The Data-as-Material Rule.** Use Fragment Mono for state, date, code, and
metadata so schedule information reads as an object. Use Source Serif for
warmth and Archivo for direct action; do not flatten every voice into one face.

**The Cap Rule.** Display headlines are large but capped below 6rem. A strong
statement should remain legible as a complete sentence rather than becoming a
wall of oversized type.

## Layout

The public shell is a single responsive document on a warm-paper field. The
desktop container is `90rem` wide with a gutter of
`clamp(1rem, 3vw, 3rem)`. A very light two-rem vertical paper grid sits behind
the desktop canvas; mobile removes that texture so the narrow composition stays
quiet. Sections are separated by hairlines and use a shared vertical rhythm of
`clamp(4.5rem, 10vw, 9rem)`.

### Homepage topology

The homepage is a deliberate sequence, not a generic card grid:

1. A dark membership signal strip and calendar-cell wordmark establish the live waitlist state.
2. A three-column docket names membership/location, ordinary-plan/cancellation logic, and issue/waitlist state.
3. The Dispatch Wall hero pairs the statement, explanatory letter copy, waitlist CTA, and one illustrative plan strip.
4. A cobalt manifesto field introduces the supporting letter world.
5. The lifecycle panel makes cancellation visibly terminal and successful.
6. A dark public-truth wall states completed-plan reality in reader language, including an honest zero state, without exposing storage or workflow terminology.
7. Two world panels place the calendar beside correspondence.
8. Tier panels explain increasing physical/human fulfilment without increasing belonging.
9. Quiet belonging, trust/provenance, final invitation, and the dark footer close the relationship.

The desktop Dispatch Wall is a full-width semantic strip with a cobalt top rail,
date/plan rows, a vermilion cancellation field, a reference/barcode row, and a
state rail. It occupies the visual centre without becoming a decorative card
shell. On mobile the same object stacks into a readable strip; a compact
“future date / no attendance required” status field carries the cancellation
moment into the first viewport before the explanatory copy and CTA.

### Responsive rules

- The desktop navigation and full-width header CTA yield to a native `<details>` menu at `70rem` (1120px). The menu locks background scrolling and makes the page/footer inert while open.
- At `64rem` (1024px), the hero, manifesto/counter support grids, and final invitation simplify; the illustrative dispatch card is capped at `38rem` and centred.
- At `48rem` (768px), the gutter becomes `1rem`, hero and section grids stack, tier/world/supporting grids become one column, the data strip becomes 2×2, and the dispatch rail becomes vertical.
- The waitlist route uses a `78rem` shell and stacks its hero and brief/form columns at `680px`; the 390px capture is the QA baseline for its composed mobile form.
- The minimum supported layout is 320 CSS pixels; QA is performed at 390px. Essential content remains in DOM order and there is no horizontal overflow.

### Route exceptions

`/waiting-list/` is intentionally quieter and more task-focused than the
homepage. It uses the shared Base chrome and tokens but its `pwy-*` surface
styles use a `78rem` shell, a two-column “brief + form” topology, a raised
form surface, explicit free/no-payment status, and a short three-step
arrangement. Query-selected tier/chapter preferences are shown as interest
only; they never activate membership. This exception is a focus treatment,
not a second brand.

Operator/member surfaces may be denser and more state-forward, but they retain
the same colours, semantic state vocabulary, and truth rules. They should not
borrow the homepage's persuasive composition when a queue, deadline, or
terminal outcome is the task.

## Elevation & Depth

Depth is tonal and paper-like rather than glossy. The paper field, raised-paper
surfaces, hairlines, dashed separators, and occasional restrained shadow make
the dispatch object feel handled while preserving scanability. The global paper
shadow is `0 1px 0 rgb(18 17 15 / 12%), 0 18px 50px rgb(18 17 15 / 8%)`;
the homepage dispatch card uses a stronger but still diffuse
`0 1.4rem 3.2rem rgb(18 17 15 / 16%)`; the manifesto letter uses a rotated,
raised sheet to signal correspondence. Shadows are not a substitute for state
or structure.

### Shadow Vocabulary

- **Paper lift:** The shared restrained paper shadow for raised forms, letters, and supporting surfaces.
- **Dispatch lift:** The larger diffuse shadow under the hero plan strip; it separates the operational artefact from the paper field.
- **Letter lift:** A stronger shadow and a one-degree desktop rotation on the manifesto sheet; the rotation is removed on mobile.
- **Lifecycle lift:** The self-contained lifecycle panel uses a light paper shadow and a subtle internal wash; the state remains readable without it.

### Material and asset strategy

The shipped public routes use CSS paper, grid geometry, rules, rails, dashes,
and a generated barcode-like reference mark. The approved Dispatch Wall raster
mock is direction only; it does not ship as a UI image and its text is not
baked into production imagery. Lucide supplies fine-stroke functional icons;
the calendar cell is the primary mark, never a crest. Approved raster assets
may support correspondence when a route explicitly needs them, but no
generated asset may carry essential text, a venue claim, a statistic, or a
state that the HTML does not also express.

### Named Rules

**The Flat-at-Rest Rule.** Let paper, ink, and rules establish hierarchy first.
Use shadows only to clarify a physical sheet or a stateful surface; do not add
generic floating cards, glass, blobs, or glossy gradients.

## Shapes

The form language is square to nearly square. Standard controls, buttons,
fields, tier panels, world panels, and the Dispatch Wall use no radius; the
small shared radius (`0.125rem`) is an alias for the system's slight softness,
not an invitation to round every surface. Lifecycle panels use a restrained
`0.45rem` corner because the component is a distinct semantic module.

Hairline rules are structural: border-blocks separate sections, dashed rules
mark schedule transitions, and the lifecycle rail shows progress. Circular
geometry is reserved for status dots, lifecycle markers, and compact status
pills. The lifecycle current-state pill is the exception to the square control
rule and uses a `999px` radius because it is a compact status capsule, not a
generic decoration.

## Components

### Site chrome and navigation

The dark signal strip announces “Waitlist open” and “Paid membership remains
closed.” The calendar-cell wordmark uses a cobalt header and a simple day
number. Desktop navigation is uppercase Archivo with a vermilion active
underline; the waitlist CTA is a vermilion block that turns ink/cobalt on
hover. At narrow widths, a native `<details>` menu replaces the nav, uses a
square bordered summary, and supports Escape, focus return, inert background
content, and no-JavaScript navigation.

### Dispatch hero and plan strip

The hero is the signature public component. Its heading is semantic HTML, its
explanatory paragraph uses Source Serif, and its CTA is an explicit waitlist
action. The illustrative strip anatomy is:

1. cobalt `PWY / Ordinary plan` top rail with an “Illustrative plan only” label;
2. future date cell with month/day language and a large date number;
3. plausible plan/time row marked “On schedule”;
4. vermilion “Cancelled, as promised” fulfilment panel;
5. illustrative plan reference plus barcode geometry;
6. numbered rail: invitation, optional anticipation, deliberate unmaking, continuing relationship.

On mobile, the strip becomes one column and the separate vermilion mobile
status keeps “No attendance required” and “Cancelled, as promised” visible in
the first viewport. The plan stays an example; it never implies a real venue,
booking, partnership, or event attendance.

### Plan lifecycle

`PlanLifecycle` is the reusable semantic lifecycle module. It exposes the only
valid visual states: `invited → planned → approaching → cancelled → archived`.
It renders a labelled title, optional detail, date/chapter/status/place facts,
and a five-step progress rail. `cancelled` and `archived` use the success
colour because cancellation is successful fulfilment. `attended`,
`checked_in`, `no_show`, and `rsvp` are explicitly forbidden and must never be
introduced as visual states. The homepage uses a static server-rendered
cancelled example, with the example/fixture boundary stated in its copy; a
future interactive host may provide a bounded “continue” control without
letting the component mutate truth by itself.

At 48rem the facts become a two-column grid, the progress rail becomes a
vertical sequence, and the footer action stacks. The module is legible with
CSS or JavaScript absent.

### Buttons, links, fields, and status

Primary and signal buttons are square, ink or text-vermilion, Fragment Mono,
uppercase, and at least `3.25rem` high where the shared button primitive is
used. Hover may move a primary surface to cobalt, but the text action remains
explicit. Paper buttons are reserved for dark/signal contexts. Links use
text-safe cobalt and an underline that strengthens on hover.

The waitlist form uses labelled email/name/chapter fields, a raised paper
surface, a full-width submit button, and a live status region. Required and
optional fields are stated in text; selected tier/chapter preferences are
echoed as non-activating interest. Errors and successful submission states are
distinct, truthful, and never hidden behind colour alone.

### Content surfaces

Manifesto letters, the public-truth wall, two-world panels, tier panels, quiet
belonging rules, trust/provenance, and the final invitation are compositional
surfaces built from the same shell, typography, lines, and tonal fields. Tier
cards may use a pale cobalt tint or correspondence blush to distinguish
fulfilment material, never to imply rank or greater belonging.

### Interaction and motion

The shipped experience has no hydrated motion runtime. CSS handles hover,
focus, the native disclosure menu, and small state feedback. `PlanLifecycle`
is server-rendered and static on the public homepage; it does not animate a
state change without a host-provided action. The approved motion vocabulary
remains semantic for future work: invitation settle (280–420ms), plan placement
(180–260ms), approaching presence (400–700ms), cancellation (140–220ms),
relief/space opening (320–520ms), correspondence reveal (320–600ms), and
operator error (0–120ms). Nothing essential waits on movement.

### Reduced motion and accessibility

The global `prefers-reduced-motion: reduce` rule disables smooth scrolling and
collapses animation/transition duration; the lifecycle component repeats the
rule locally. Reduced motion keeps the complete cancelled/archived result and
all text, not a degraded placeholder. The system targets WCAG 2.2 AA: semantic
headings/landmarks, a skip link, real labels and live form status, focus-visible
outlines, keyboard Escape handling, DOM-order content, text alternatives for
functional icons, and no essential hover, canvas, WebGL, fine-pointer input, or
motion dependency. High-contrast mode strengthens the line tokens; print hides
navigation/actions while keeping semantic content.

## Do's and Don'ts

### Do:

- **Do** preserve the Dispatch Wall thesis: plans are made, anticipated, deliberately cancelled, and archived as a cared-for relationship.
- **Do** keep “cancellation is successful fulfilment” visible wherever a plan state is shown.
- **Do** label examples, fixtures, illustrative dates, and plausible places so they cannot be mistaken for production facts.
- **Do** use D1/runtime truth for counters, chapters, member facts, venue data, and workflow state; state zero or unavailable explicitly.
- **Do** translate implementation truth into language a visitor can understand; storage engines,
  state machines, audit mechanics, provider names, and internal workflow terms stay out of public
  product copy.
- **Do** keep belonging equal across Member, Corresponding Member, and Deluxe Member; higher tiers may add physical/human intensity only.
- **Do** preserve semantic text and keyboard/focus/reduced-motion paths when adding visual polish.
- **Do** keep the calendar mark, cobalt schedule logic, vermilion cancellation signal, and Source Serif correspondence warmth in their named roles.
- **Do** run `mise run acceptance` and review the 1440×1000 desktop and 390×844 mobile captures after a material visual change.

### Don't:

- **Don't** introduce `ATTENDED`, `CHECKED_IN`, `NO_SHOW`, or RSVP language for ordinary plans.
- **Don't** imply a real booking, venue partnership, endorsement, chapter, member count, testimonial, or paid activation without sourced truth.
- **Don't** allow AI or generated imagery to invent member facts, override consent/entitlements, or replace an auditable state transition.
- **Don't** use bright vermilion with white normal-size text; use dark ink or text vermilion for readable contrast.
- **Don't** turn the system into old-money, heraldic, wax-seal, Victorian, beige-luxury, glassmorphic, blob, or generic card-grid UI.
- **Don't** put essential text in raster art, canvas, WebGL, hover-only states, or motion-only transitions.
- **Don't** use rounded pills as generic buttons/cards; reserve them for compact status where the shape carries meaning.
- **Don't** change the public name, tier names, palette, tagline, cadence, budgets, legal wording, or other locked product decisions without the required approval.

### Maintenance rules

- Keep `src/styles/global.css` as the browser token source and keep the public brand values in `src/brand/config.ts` aligned when either changes.
- Update this document and `.impeccable/surfaces/document.md` whenever the shipped world, component grammar, or canonical route topology changes; do not document a mock as production UI.
- Treat `PRODUCT.md`, `AGENTS.md`, the route brief, and runtime/D1 state machines as authority for claims and lifecycle vocabulary. A visual change cannot relax those constraints.
- Preserve the two-route evidence set: homepage Dispatch Wall plus the quieter waitlist task surface. Re-check the exact desktop/mobile screenshots after substantial layout or type changes.
- Before handoff, report acceptance PASS/FAIL, tests, migrations/provider contracts if relevant, manual checks, open questions, and limitations. A failing acceptance run is not complete.
