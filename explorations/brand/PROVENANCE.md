# Brand Asset Provenance

> **Date:** 2026-08-23
> **Status:** Phase 2 · decision package

This file records what is known about how the assets in
`explorations/brand/assets/` were generated. Honest provenance
matters: if we know a piece of text in an image is AI-garbled, we say
so; if we know nothing about a model's identity, we say so too.

The previous session's notes were not preserved as machine-readable
metadata. The current session does not invent provenance it cannot
verify. Where a known limitation exists, the asset is recorded as
**concept** rather than **candidate** or **production-ready**.

---

## 1. Generation model (best available knowledge)

The previous session produced 24 image assets (8 slots × 3 directions).
Based on the visual register and the system memory note about
`image-01`'s text-rendering limits, the working assumption is that the
images were generated via the project MiniMax CLI tool using
`mmx image generate` with the `image-01` model. **This is an inference,
not a verified record.** The previous session did not retain a
machine-readable generation log, and the current session cannot recover
one.

The two SVG seals in `public/explorations/brand/seals/` were generated
by the current session, hand-written, in pure SVG with no AI
involvement.

---

## 2. Per-asset provenance

### Direction A — `explorations/brand/assets/a/`

| File               | Generator                    | Prompt (best reconstruction)                                                                    | Status                                                                 |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `hero_001.jpg`     | MiniMax `image-01` (assumed) | "cream paper envelope on warm wood, vermilion wax seal, soft window light, no text, photograph" | concept                                                                |
| `seal_001.jpg`     | MiniMax `image-01` (assumed) | "circular paper seal, monoline 1pt border, monogram, fine arc text, monoline"                   | concept-only; AI-typography garbled — see `seals/seal-a-modernist.svg` |
| `card_001.jpg`     | MiniMax `image-01` (assumed) | "cream paper card, vermilion monogram top-left, name line, no other text"                       | concept                                                                |
| `invite_001.jpg`   | MiniMax `image-01` (assumed) | "cream paper on warm wood, single wax seal, no other text"                                      | concept                                                                |
| `cancel_001.jpg`   | MiniMax `image-01` (assumed) | "aged paper on warm wood, single small wax seal bottom-right, no other text"                    | concept                                                                |
| `og_001.jpg`       | MiniMax `image-01` (assumed) | "wide negative-space composition, cream paper, single vermilion seal"                           | concept                                                                |
| `artefact_001.jpg` | MiniMax `image-01` (assumed) | "brushed brass medallion on cream paper, engraved seal, soft light"                             | concept                                                                |
| `archive_001.jpg`  | MiniMax `image-01` (assumed) | "aged cream paper on grey table, single small seal at top, signature at bottom"                 | concept                                                                |

### Direction B — `explorations/brand/assets/b/`

| File               | Generator                    | Prompt (best reconstruction)                                                       | Status  |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------------- | ------- |
| `hero_001.jpg`     | MiniMax `image-01` (assumed) | "cream paper on walnut desk, oxblood wax seal, brass fountain pen, low warm light" | concept |
| `seal_001.jpg`     | MiniMax `image-01` (assumed) | "oxblood wax seal, shield, R monogram, laurel, rope border"                        | concept |
| `card_001.jpg`     | MiniMax `image-01` (assumed) | "cream paper card, gold filigree border, brass monogram, oxblood edge"             | concept |
| `invite_001.jpg`   | MiniMax `image-01` (assumed) | "cream paper on walnut, oxblood deckle border, oxblood wax seal"                   | concept |
| `cancel_001.jpg`   | MiniMax `image-01` (assumed) | "cream paper on walnut, oxblood deckle border, oxblood wax seal, same as invite"   | concept |
| `og_001.jpg`       | MiniMax `image-01` (assumed) | "wide composition, walnut wood, cream paper, single oxblood wax seal"              | concept |
| `artefact_001.jpg` | MiniMax `image-01` (assumed) | "polished brass medallion on walnut, engraved emblem"                              | concept |
| `archive_001.jpg`  | MiniMax `image-01` (assumed) | "aged paper on walnut, oxblood wax seal, faint handwriting"                        | concept |

### Direction C — `explorations/brand/assets/c/`

| File               | Generator                    | Prompt (best reconstruction)                                                 | Status  |
| ------------------ | ---------------------------- | ---------------------------------------------------------------------------- | ------- |
| `hero_001.jpg`     | MiniMax `image-01` (assumed) | "cream envelope on warm wood, hand-drawn monogram, fountain pen, soft light" | concept |
| `seal_001.jpg`     | MiniMax `image-01` (assumed) | "hand-drawn R inside wobbly circle, fountain pen line, warm paper"           | concept |
| `card_001.jpg`     | MiniMax `image-01` (assumed) | "warm paper card, hand-drawn R top-left, fountain pen, walnut"               | concept |
| `invite_001.jpg`   | MiniMax `image-01` (assumed) | "warm paper on walnut, fountain pen, hand-drawn monogram"                    | concept |
| `cancel_001.jpg`   | MiniMax `image-01` (assumed) | "warm paper on walnut, fountain pen, soft light, no text"                    | concept |
| `og_001.jpg`       | MiniMax `image-01` (assumed) | "warm wood, fountain pen, hand-drawn monogram, notebook, warm light"         | concept |
| `artefact_001.jpg` | MiniMax `image-01` (assumed) | "wooden medallion, hand-drawn R monogram, warm paper envelope"               | concept |
| `archive_001.jpg`  | MiniMax `image-01` (assumed) | "aged warm paper on walnut, fountain pen, hand-drawn marks"                  | concept |

### Production SVG seals — `public/explorations/brand/seals/`

| File                      | Generator                                | Status               |
| ------------------------- | ---------------------------------------- | -------------------- |
| `seal-a-modernist.svg`    | Hand-written, current session 2026-08-23 | **production-ready** |
| `seal-b-old-world.svg`    | Hand-written, current session 2026-08-23 | **production-ready** |
| `seal-c-quiet-modern.svg` | Hand-written, current session 2026-08-23 | **production-ready** |

---

## 3. Honest gaps

- The exact MiniMax model id is **inferred**, not verified.
- The exact prompt per asset is **best-effort reconstruction**, not
  preserved.
- No seed, no aspect-ratio metadata, no temperature, no width/height
  is preserved alongside the JPGs.
- A future Phase 2 pass that wants reproducible regeneration must
  rewrite the generation log to retain:
  - prompt
  - model id
  - aspect ratio
  - output dimensions
  - seed
  - date
  - intended direction/slot

The current session does not invent this metadata.
