# OG / Social System

> **Date:** 2026-08-23
> **Status:** Phase 2 · decision package

This note specifies the OG / social image system for the four canonical
routes the site will share. The goal is honest, useful preview cards
that survive the safe-zone crop rules of every major social platform.

The previous session produced a single `og_001.jpg` per direction as a
hero fallback. That asset is the **default-site** OG candidate. The
other three canonical routes — membership, how-it-works, journal —
need their own OG assets, generated to the same spec.

The Social Club product invariant (per `AGENTS.md` and
`docs/18_LOCKED_AND_OPEN_DECISIONS.md`) is that the OG image must not
falsely claim a real event is happening. The OG image is therefore
**a brand image, not a constructed-event image**.

---

## 1. Canonical routes and OG assets

| Route                        | OG asset filename                       | Aspect   | Visual                                                                              |
| ---------------------------- | --------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `/`                          | `og_001.jpg` (existing per direction)   | 1200×630 | Brand hero with seal centred low                                                    |
| `/membership`                | `og-membership.jpg` (to be generated)   | 1200×630 | Membership card / medallion centred, on warm paper                                  |
| `/how-it-works`              | `og-how-it-works.jpg` (to be generated) | 1200×630 | The two-document pair: invitation and cancellation, side by side                    |
| `/journal`                   | `og-journal.jpg` (to be generated)      | 1200×630 | A single Society page (e.g. a chapter report) with the seal top-left                |
| `/chapters/melbourne` (etc.) | `og-chapter.jpg` (to be generated)      | 1200×630 | A single chapter's visual identity — same template, chapter name in mono small caps |
| `/waiting-list`              | `og-waiting-list.jpg` (to be generated) | 1200×630 | The CTA card — single sentence, single seal, single button                          |

All assets are 1200×630 (the standard Facebook / LinkedIn /
Twitter-X OG size). The same image is reused for Twitter-X
`summary_large_image` (which expects 2:1, close enough).

---

## 2. Safe-zone rules (cross-platform)

The OG crop on Twitter-X is approximately 1200×600; Facebook and
LinkedIn show the full 1200×630; Slack and iMessage show a centred
crop. The safe zone is therefore:

- The centre 1100×550 of the 1200×630 image. **All critical content
  lives inside this rectangle.**
- Anything in the top 30 px, the bottom 30 px, or the left/right 50 px
  is at risk of being cropped by at least one platform.
- Text is rendered at a minimum 36 px at the source size for legibility
  on a phone preview.
- No text below 24 px at the source size is allowed.

The brand wordmark is allowed outside the safe zone **as a repeated
watermark or in a quiet corner**, never as the primary readable
content.

---

## 3. Production system (recommended)

Because the same system has to work for all three brand directions
**and** survive a direction change, the OG system should be **SVG
templates** rendered to JPG at build time, not AI-generated JPGs. This:

1. Keeps text legible (real typography).
2. Lets the same template render for any direction.
3. Survives the user changing the wordmark without re-generating JPGs.
4. Stays under the OG size budget.

A minimal SVG template for a hero OG looks like:

```svg
<svg viewBox="0 0 1200 630" width="1200" height="630"
     xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#F4F1EA"/>          <!-- paper -->
  <g transform="translate(600 360)">
    <use href="/explorations/brand/seals/seal-A-or-B-or-C.svg"/>
  </g>
  <text x="600" y="540" text-anchor="middle"
        font-family="ui-monospace, monospace"
        font-size="36" letter-spacing="6" fill="#0F1115">
    THE  RESERVED  SOCIETY
  </text>
</svg>
```

Rendered to JPG at 1200×630, the result is 50–80 KB. This is the OG
template for the default site. The membership, how-it-works, journal
and chapter OG assets use the same template with the appropriate slot
asset (`card_001.jpg`, `invite_001.jpg` + `cancel_001.jpg` side by
side, the journal page mockup, and the chapter-specific visual
respectively).

**This is a Phase 3 implementation. Phase 2 only specifies the system
and confirms the existing `og_001.jpg` per direction is a candidate
for the default-site OG.**

---

## 4. Existing OG candidates (decision-galllery quality)

The previous session produced `assets/{a,b,c}/og_001.jpg` as a
default-site OG candidate. Each is a wide negative-space composition
with a single seal. Assessment:

| Direction | File                  | Visual quality | Use as default-site OG?                     |
| --------- | --------------------- | -------------- | ------------------------------------------- |
| A         | `assets/a/og_001.jpg` | Strong         | **Yes**, but re-render with real typography |
| B         | `assets/b/og_001.jpg` | Excellent      | **Yes**, but re-render with real typography |
| C         | `assets/c/og_001.jpg` | Strong         | **Yes**, but re-render with real typography |

A Phase 3 build replaces these JPGs with SVG-rendered JPGs that use
the canonical SVG seal and the canonical wordmark.

---

## 5. Per-platform note

- **iMessage / Slack / WhatsApp**: show a centred 1.91:1 crop. The SVG
  template's safe zone covers this.
- **Twitter-X**: shows the full 1200×630, sometimes 1200×600. The
  template is large enough that the bottom 30 px can be safe.
- **LinkedIn**: full 1200×630.
- **Facebook**: full 1200×630.
- **Discord / Telegram**: full 1200×630.

In all cases, the safe zone is inside the centre 1100×550, so the
template is correct.
