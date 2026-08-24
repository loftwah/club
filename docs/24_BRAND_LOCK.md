# Brand Lock — Plans With You

> **Status:** LOCKED, 2026-08-24
> **Source of truth:** `src/brand/config.ts`
> **Cadence source of truth:** `src/brand/cadence.ts`

This document is the human-readable summary of the locked production
brand. The TypeScript config is the authoritative source.

## 1. Identity

| Field       | Value                                 |
| ----------- | ------------------------------------- |
| Name        | Plans With You                        |
| Short name  | Plans With You                        |
| Legal name  | Plans With You Pty Ltd                |
| Tagline     | You are wanted. You don't have to go. |
| Proposition | (see brand.ts)                        |
| Locked      | true                                  |
| Locked on   | 2026-08-24                            |

Tier names (locked):

- A$5/month — **Member**
- A$20/month — **Corresponding Member**
- A$50/month — **Deluxe Member**

Higher tiers buy more physical and human intensity. They are not
more loved.

## 2. Visual direction

**Primary:** World 1 — On Schedule. The calendar is the artefact.
Cancellation is the design. Contemporary editorial register, ink on
warm paper, single distinctive orange-vermilion cancellation/status
signal.

**Supporting warmth:** World 2 — In The Post. Used only for personal
correspondence, physical letters, birthday/anniversary material,
envelopes, packages, and selected tactile photography.

**Not used:** faux heritage styling, old-money cues, wax-seal
obsession, Victorian treatment, generic prestige-club aesthetics.
No crest, no monogram, no faux heritage seal.

## 3. Core visual language

The recurring graphic device is a calendar cell showing
PLAN / 21 / CANCELLED, framed by the brand accent. The cell is the
artefact. The cancellation mark is the same form as the invitation.

The signature emotional arc:

> I was on the list
> → Plans were made
> → The plan felt plausible
> → The date approached
> → The plan was unmade
> → I am still on the list

## 4. Typography

Production-safe system stack (no CDN, no font request):

- **Serif** (display / wordmark / body): `"Iowan Old Style",
"Palatino Linotype", Palatino, "URW Palladio L", "P052",
"Source Serif Pro", Georgia, serif`
- **Sans** (UI / nav / forms): `ui-sans-serif, system-ui,
-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
sans-serif`
- **Mono** (status / date / member number): `ui-monospace,
SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono",
monospace`

Why system fonts:

- Zero network request.
- No privacy surface.
- No CDN dependency.
- Iowan Old Style renders with editorial character on Apple
  devices; Palatino is the cross-platform fallback; Georgia is
  the universal last resort.

## 5. Colour

| Token             | Value     | Use                           | WCAG on bg       |
| ----------------- | --------- | ----------------------------- | ---------------- |
| `bg`              | `#F5F2EA` | Warm paper (canvas)           | —                |
| `bgElev`          | `#E8E3D2` | Raised surface                | —                |
| `fg`              | `#111111` | Ink (body)                    | 17.6:1 AAA       |
| `fgMuted`         | `#3A3A3A` | Soft ink (body / captions)    | 10.0:1 AAA       |
| `fgFaint`         | `#6A6A6A` | Dim (footers / micro)         | 4.9:1 AA         |
| `accent`          | `#B23A12` | Text-safe orange-vermilion    | 5.6:1 AA         |
| `accentBright`    | `#FF5A1F` | Bright signal (graphics only) | 3.1:1 (graphics) |
| `accentDim`       | `#222222` | Rule                          | —                |
| `accentSoft`      | `#F1D9C9` | Accent background             | —                |
| `accentSecondary` | `#5C1A1B` | Oxblood (secondary)           | 10.4:1 AAA       |
| `success`         | `#1B6E3A` | Success feedback              | 5.4:1 AA         |
| `error`           | `#A12622` | Error feedback                | 6.6:1 AA         |

All foreground/background pairs in normal text use pass WCAG AA
(4.5:1). The accent is text-safe. `accentBright` is reserved for
graphics and large display uses only.

## 6. Production cadence (locked)

See `src/brand/cadence.ts`.

- **Invitations per month:** 1–2 per member.
- **Invitation lead time:** 7–21 days before the constructed event.
- **Default cancellation style:** Traditional (12–36 hours before
  the event).
- **Cancellation styles:**
  - Merciful: 48–72 hours before.
  - Traditional: 12–36 hours before.
  - Last Minute: 2–8 hours before.
- **Never** cancel after the event has begun. The safety monitor is
  authoritative.
- **Event variety:** vary type, day, time, neighbourhood, scale,
  tone, lead time, and reason across a member's history.

## 7. Tagline

The locked tagline is:

> You are wanted. You don't have to go.

It supports "Plans With You" without mechanically repeating the
brand name. The homepage hero carries the proposition
("Plans were made. Plans were unmade.") which is the more
narrative line; the tagline is the short version used in social
copy, OG cards, and the footer.

## 8. What is NOT in the brand

- No "Society" or "Club" as a self-referential noun in production
  copy. The brand name is "Plans With You" and the operator voice
  is "we" / "us" / "our".
- No historical Round 1 / "Reserved Society" branding in
  production surfaces.
- No "core" / "correspondence" / "deluxe" as display names — the
  production names are "Member" / "Corresponding Member" / "Deluxe
  Member".
- No fake heritage seal. The recurring mark is a calendar cell.

## 9. Brand-as-data

The brand is data. The same `src/brand/config.ts` is read by:

- the public layout (`Base.astro`) for the wordmark, nav, footer,
  and meta;
- the OG image generator (`src/lib/og.ts`, `scripts/og-generate.mjs`)
  for the social card;
- the page templates (membership, how-it-works, correspondence, faq,
  chapters, journal) for tone and copy;
- the portal (login, memory, commitments, appearance) for tone;
- the operator runbook and admin pages.

Changing the brand is a single-file edit plus a regeneration of the
OG cards via `node scripts/og-generate.mjs`. There is no
copy-paste across files.
