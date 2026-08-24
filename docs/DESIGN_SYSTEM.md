# Design system — Dispatch Wall

The production direction is **On Schedule / Dispatch Wall**. It treats the
calendar and administrative state change as the primary product artefact. **In
the Post** supplies physical warmth for correspondence, not a heritage or
luxury theme.

## Principles

1. Status is visual language, not decoration.
2. Cancellation is decisive and successful, never an error treatment.
3. Every number and claim is either sourced or explicitly illustrative.
4. Higher tiers become more tangible, never more belonging.
5. Paper can feel handled without wax, heraldry, faux ageing or beige luxury.
6. Dense operator information and calm member information share the same truth
   but not the same visual density.

## Tokens

The canonical browser tokens live in `src/styles/global.css`; programmatic
surfaces share matching values from `src/brand/config.ts`.

| Role             | Value     | Use                                   |
| ---------------- | --------- | ------------------------------------- |
| Schedule paper   | `#F5F1E7` | Default canvas                        |
| Raised paper     | `#FBF9F3` | Cards and correspondence              |
| Ink              | `#12110F` | Primary text and rules                |
| Soft ink         | `#4E4B44` | Body copy                             |
| Faint ink        | `#69655D` | Metadata, AA on paper                 |
| Calendar cobalt  | `#2447FF` | Schedule headers, selected state      |
| Text cobalt      | `#1932BE` | Links on paper                        |
| Signal vermilion | `#E94616` | Dots and graphics, or with dark text  |
| Text vermilion   | `#B9340E` | Text and surfaces carrying white text |
| Correspondence   | `#F7D9CC` | In-the-Post warmth                    |

The bright vermilion does not carry white normal-size text: that pair is below
AA. Use dark ink on the bright signal or white on the darker text vermilion.

## Typography

- **Archivo Variable** — display, navigation and product interface. Its direct,
  slightly compressed voice makes the schedule feel contemporary.
- **Source Serif 4 Variable** — letters, explanatory passages and human warmth.
- **Fragment Mono** — dates, states, member numbers, codes and audit metadata.

All faces are self-hosted through Fontsource. There is no font CDN or runtime
loader.

## Form and component language

Corners are square or nearly square. Hairlines and grid divisions provide
structure. Shadows represent a real paper layer and remain restrained. Pills
are reserved for compact status, not generic decoration. Buttons describe a
real action; the interface avoids icon-only controls when a text label fits.

The primary mark is a small calendar cell, not a crest or traditional logo.
Lucide icons use consistent fine strokes and only clarify a concept or action.

## Two surface modes

**Public/member:** large hierarchy, generous explanation, soft paper and clear
permission language.

**Operator:** denser grid, strong queue/state labels, explicit deadlines and
terminal outcomes. Decorative motion is excluded from errors and critical
work.
