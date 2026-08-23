#!/bin/bash
# Phase 2 R2 — generate visual concepts for 4 worlds
# Each world gets 8 slots x 2 candidates = 16 generations
# Total: 64 generations
#
# IMPORTANT: per system memory, image-01 only renders requested text
# correctly ~33% of the time. Prompts ask for shapes/marks/single
# characters, never full words.

set -e

ROOT="/Users/deanlofts/gits/club"
W1="$ROOT/explorations/brand/r2-assets/w1"
W2="$ROOT/explorations/brand/r2-assets/w2"
W3="$ROOT/explorations/brand/r2-assets/w3"
W4="$ROOT/explorations/brand/r2-assets/w4"

mmx() {
  /Users/deanlofts/.cache/npm/global/bin/mmx image generate --quiet "$@"
}

echo "=== World 1: On Schedule (calendar mechanics) ==="

# 1. Hero / homepage - large calendar card with single date + dot
mmx --prompt "A single cream paper card standing on a clean light table, the card is white paper with a single small date printed in clean dark grotesque type and a small orange dot in the corner, photographed from a slight angle, soft window light from the left, contemporary editorial, minimal, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W1" --out-prefix hero
mmx --prompt "A single white paper card folded tent-style on a clean light surface, the card has a single number printed cleanly in dark type and a tiny orange dot, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W1" --out-prefix hero

# 2. Invitation - calendar card with INVITED state
mmx --prompt "A single white paper card on a clean desk, the card has a single date printed in clean dark type and a small orange dot in the top-right corner, photographed from above, soft daylight, contemporary editorial, no other text, no logo" \
    --aspect-ratio 4:3 --out-dir "$W1" --out-prefix invite
mmx --prompt "A small white paper card on a clean light surface, a single date printed in clean dark type, a thin horizontal line through the date, contemporary editorial photograph, soft daylight, minimal, no other text" \
    --aspect-ratio 4:3 --out-dir "$W1" --out-prefix invite

# 3. Cancellation - the same card, with strikethrough / cancelled mark
mmx --prompt "A single white paper card on a clean desk, the card has a single date with a thin horizontal line through the middle of the date, a small orange dot in the corner, soft daylight, contemporary editorial, photographed from above, no other text" \
    --aspect-ratio 4:3 --out-dir "$W1" --out-prefix cancel
mmx --prompt "A small white paper card on a clean surface, a single date with a thin line through it, an orange dot in the corner, soft daylight, contemporary editorial photograph, minimal, no other text" \
    --aspect-ratio 4:3 --out-dir "$W1" --out-prefix cancel

# 4. Membership card - small format, single dot
mmx --prompt "A single small white plastic card on a clean surface, the card has a single small orange dot in the top-right corner, a single number printed in clean dark type, soft daylight, contemporary editorial, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W1" --out-prefix card
mmx --prompt "A small white card on a clean surface, an orange dot and a single number, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W1" --out-prefix card

# 5. Birthday - card with a small mark
mmx --prompt "A single white paper card on a clean surface, a small orange dot in the top-right corner, a single number printed in clean dark type, soft daylight, contemporary editorial, photographed from above, no other text" \
    --aspect-ratio 4:3 --out-dir "$W1" --out-prefix birthday
mmx --prompt "A small white card on a clean surface, an orange dot and a single number, soft daylight, contemporary editorial, no other text" \
    --aspect-ratio 4:3 --out-dir "$W1" --out-prefix birthday

# 6. Physical package - matte paper sleeve
mmx --prompt "A single matte cream paper sleeve on a clean surface, the sleeve has a small orange dot printed on the front, photographed from above, soft daylight, contemporary editorial, no other text, no logo" \
    --aspect-ratio 1:1 --out-dir "$W1" --out-prefix package
mmx --prompt "A small cream paper sleeve on a clean surface, a single orange dot printed on the front, soft daylight, contemporary editorial photograph, no other text" \
    --aspect-ratio 1:1 --out-dir "$W1" --out-prefix package

# 7. OG / social - wide negative space
mmx --prompt "A wide clean composition with a single small white paper card in the center, the card has a small orange dot, the rest of the composition is clean cream negative space, soft daylight, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W1" --out-prefix og
mmx --prompt "A wide clean editorial composition with a single small orange dot in the center of clean cream paper, soft daylight, minimal, no other text" \
    --aspect-ratio 16:9 --out-dir "$W1" --out-prefix og

# 8. Supporting brand imagery - the calendar cell as an object
mmx --prompt "A small white paper card with a single orange dot, sitting on a clean surface, soft window light from the side, contemporary editorial photograph, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W1" --out-prefix supporting
mmx --prompt "An editorial close-up of a single small orange dot printed on cream paper, soft daylight, contemporary, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W1" --out-prefix supporting

echo "=== World 2: In The Post (warm, hand-written, mailbox) ==="

# 1. Hero / homepage - envelope on warm surface
mmx --prompt "A single cream paper envelope on a warm wood surface, the envelope is slightly off-axis, a small hand-drawn mark in the top-left corner in soft brown ink, soft warm late-afternoon window light, contemporary warm editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix hero
mmx --prompt "A small cream envelope on warm wood, a small hand-drawn mark in the corner, soft warm window light, contemporary editorial photograph, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix hero

# 2. Invitation - hand-written note
mmx --prompt "A single cream paper card with a small hand-written note in soft brown ink, the note is a single short line, a small drawn flourish at the bottom, on a warm wood surface, soft warm window light, contemporary editorial, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix invite
mmx --prompt "A small cream card on warm wood, a hand-written mark and a small drawn flourish, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix invite

# 3. Cancellation - same paper, gentler
mmx --prompt "A single cream paper card on warm wood, a hand-written mark and a small drawn flourish, soft warm window light, contemporary editorial, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix cancel
mmx --prompt "A small cream card on warm wood, a hand-drawn mark, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix cancel

# 4. Membership card - warm paper, single spot
mmx --prompt "A small cream paper card on warm wood, a single small hand-drawn mark in the top-left corner, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix card
mmx --prompt "A small warm-paper card on warm wood, a hand-drawn mark in the corner, soft warm window light, contemporary editorial photograph, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix card

# 5. Birthday - hand-written
mmx --prompt "A single small cream paper card with a hand-written mark and a small drawn flourish at the bottom, on warm wood, soft warm window light, contemporary editorial, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix birthday
mmx --prompt "A small cream card with a hand-drawn mark, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix birthday

# 6. Physical package - unbleached paper
mmx --prompt "A single unbleached paper sleeve on warm wood, a small hand-drawn mark on the front, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix package
mmx --prompt "A small unbleached paper sleeve on warm wood, a hand-drawn mark on the front, soft warm window light, contemporary editorial photograph, no other text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix package

# 7. OG / social - wide
mmx --prompt "A wide warm composition with a single cream envelope on warm wood in the center-left, the envelope has a small hand-drawn mark, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix og
mmx --prompt "A wide warm composition with a single cream paper card on warm wood, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix og

# 8. Supporting - the letter as object
mmx --prompt "A small cream paper letter on warm wood, a hand-written mark and a small drawn flourish, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix supporting
mmx --prompt "A close-up of a hand-written mark on cream paper, soft warm window light, contemporary editorial, minimal, no readable text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix supporting

echo "=== World 3: Cordially (single word, contemporary, confident) ==="

# 1. Hero / homepage - the wordmark at large size on clean surface
mmx --prompt "A single small off-white card on a clean light surface, the card has a single small red dot and a single short mark, contemporary editorial photograph, soft daylight, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix hero
mmx --prompt "A small off-white card on a clean surface, a single small red dot, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix hero

# 2. Invitation - the same card with a single mark
mmx --prompt "A single small off-white card on a clean surface, a small red dot in the corner and a single short mark, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix invite
mmx --prompt "A small off-white card on a clean surface, a small red dot, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix invite

# 3. Cancellation - the same card, same form
mmx --prompt "A single small off-white card on a clean surface, a small red dot in the corner and a single short mark, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix cancel
mmx --prompt "A small off-white card on a clean surface, a small red dot, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix cancel

# 4. Membership card - the dot
mmx --prompt "A single small off-white plastic card on a clean surface, a single small red dot in the top-right corner, a single number printed in clean dark type, soft daylight, contemporary editorial, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix card
mmx --prompt "A small off-white card on a clean surface, a red dot and a single number, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix card

# 5. Birthday - same form
mmx --prompt "A single small off-white card on a clean surface, a single small red dot in the corner, soft daylight, contemporary editorial photograph, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix birthday
mmx --prompt "A small off-white card with a small red dot, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix birthday

# 6. Physical package - off-white sleeve
mmx --prompt "A single off-white paper sleeve on a clean surface, a single small red dot printed on the front, soft daylight, contemporary editorial, no other text, no logo" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix package
mmx --prompt "A small off-white paper sleeve on a clean surface, a small red dot on the front, soft daylight, contemporary editorial photograph, no other text" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix package

# 7. OG / social - wide
mmx --prompt "A wide clean composition with a single small off-white card in the center, a small red dot, the rest of the composition is clean negative space, soft daylight, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix og
mmx --prompt "A wide clean editorial composition with a single small red dot in the center, soft daylight, minimal, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix og

# 8. Supporting - the dot as object
mmx --prompt "A small off-white card with a single small red dot, sitting on a clean surface, soft daylight from the side, contemporary editorial photograph, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix supporting
mmx --prompt "An editorial close-up of a single small red dot on off-white paper, soft daylight, contemporary, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix supporting

echo "=== World 4: A Small Programme (theatrical, slightly absurd) ==="

# 1. Hero / homepage - the programme
mmx --prompt "A single small cream paper programme booklet on a clean surface, the programme has a deep red oxblood small mark in the top-left corner and a single short line, photographed from a slight angle, soft daylight from the left, contemporary editorial, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix hero
mmx --prompt "A small cream paper programme on a clean surface, an oxblood mark in the corner, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix hero

# 2. Invitation - the programme with date
mmx --prompt "A single small cream paper programme on a clean surface, the programme has an oxblood mark in the top-left and a single short line, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix invite
mmx --prompt "A small cream programme on a clean surface, an oxblood mark in the corner, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix invite

# 3. Cancellation - the same programme, same form
mmx --prompt "A single small cream paper programme on a clean surface, the programme has an oxblood mark in the top-left and a single short line, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix cancel
mmx --prompt "A small cream programme on a clean surface, an oxblood mark in the corner, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix cancel

# 4. Membership card - the programme style
mmx --prompt "A single small cream paper card on a clean surface, the card has an oxblood mark in the top-left and a single short mark, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix card
mmx --prompt "A small cream card on a clean surface, an oxblood mark in the corner, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix card

# 5. Birthday - the programme with a flourish
mmx --prompt "A single small cream paper card on a clean surface, the card has an oxblood mark in the top-left and a small drawn flourish, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix birthday
mmx --prompt "A small cream card on a clean surface, an oxblood mark in the corner and a small flourish, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix birthday

# 6. Physical package - cream sleeve
mmx --prompt "A single cream paper sleeve on a clean surface, the sleeve has an oxblood mark on the front, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix package
mmx --prompt "A small cream paper sleeve on a clean surface, an oxblood mark on the front, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix package

# 7. OG / social - wide
mmx --prompt "A wide clean composition with a single small cream programme in the center-left, an oxblood mark in the corner, the rest of the composition is clean negative space, soft daylight, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix og
mmx --prompt "A wide clean editorial composition with a single small oxblood mark in the center, soft daylight, minimal, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix og

# 8. Supporting - the programme as object
mmx --prompt "A small cream paper programme with an oxblood mark in the corner, sitting on a clean surface, soft window light from the side, contemporary editorial photograph, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix supporting
mmx --prompt "An editorial close-up of an oxblood mark on cream paper, soft daylight, contemporary, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix supporting

echo "=== Done ==="
