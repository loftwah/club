#!/bin/bash
# W3 and W4 generation. ~32 images.

ROOT="/Users/deanlofts/gits/club"
W3="$ROOT/explorations/brand/r2-assets/w3"
W4="$ROOT/explorations/brand/r2-assets/w4"

mmx() {
  /Users/deanlofts/.cache/npm/global/bin/mmx image generate --quiet "$@"
}

echo "=== World 3: Cordially ==="

mmx --prompt "A single small off-white card on a clean light surface, the card has a single small red dot and a single short mark, contemporary editorial photograph, soft daylight, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix hero
mmx --prompt "A small off-white card on a clean surface, a single small red dot, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix hero

mmx --prompt "A single small off-white card on a clean surface, a small red dot in the corner and a single short mark, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix invite
mmx --prompt "A small off-white card on a clean surface, a small red dot, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix invite

mmx --prompt "A single small off-white card on a clean surface, a small red dot in the corner and a single short mark, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix cancel
mmx --prompt "A small off-white card on a clean surface, a small red dot, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix cancel

mmx --prompt "A single small off-white plastic card on a clean surface, a single small red dot in the top-right corner, a single number printed in clean dark type, soft daylight, contemporary editorial, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix card
mmx --prompt "A small off-white card on a clean surface, a red dot and a single number, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix card

mmx --prompt "A single small off-white card on a clean surface, a single small red dot in the corner, soft daylight, contemporary editorial photograph, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix birthday
mmx --prompt "A small off-white card with a small red dot, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W3" --out-prefix birthday

mmx --prompt "A single off-white paper sleeve on a clean surface, a single small red dot printed on the front, soft daylight, contemporary editorial, no other text, no logo" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix package
mmx --prompt "A small off-white paper sleeve on a clean surface, a small red dot on the front, soft daylight, contemporary editorial photograph, no other text" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix package

mmx --prompt "A wide clean composition with a single small off-white card in the center, a small red dot, the rest of the composition is clean negative space, soft daylight, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix og
mmx --prompt "A wide clean editorial composition with a single small red dot in the center, soft daylight, minimal, no other text" \
    --aspect-ratio 16:9 --out-dir "$W3" --out-prefix og

mmx --prompt "A small off-white card with a single small red dot, sitting on a clean surface, soft daylight from the side, contemporary editorial photograph, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix supporting
mmx --prompt "An editorial close-up of a single small red dot on off-white paper, soft daylight, contemporary, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W3" --out-prefix supporting

echo "=== World 4: A Small Programme ==="

mmx --prompt "A single small cream paper programme booklet on a clean surface, the programme has a deep red oxblood small mark in the top-left corner and a single short line, photographed from a slight angle, soft daylight from the left, contemporary editorial, no other text, no logo" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix hero
mmx --prompt "A small cream paper programme on a clean surface, an oxblood mark in the corner, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix hero

mmx --prompt "A single small cream paper programme on a clean surface, the programme has an oxblood mark in the top-left and a single short line, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix invite
mmx --prompt "A small cream programme on a clean surface, an oxblood mark in the corner, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix invite

mmx --prompt "A single small cream paper programme on a clean surface, the programme has an oxblood mark in the top-left and a single short line, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix cancel
mmx --prompt "A small cream programme on a clean surface, an oxblood mark in the corner, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix cancel

mmx --prompt "A single small cream paper card on a clean surface, the card has an oxblood mark in the top-left and a single short mark, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix card
mmx --prompt "A small cream card on a clean surface, an oxblood mark in the corner, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix card

mmx --prompt "A single small cream paper card on a clean surface, the card has an oxblood mark in the top-left and a small drawn flourish, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix birthday
mmx --prompt "A small cream card on a clean surface, an oxblood mark in the corner and a small flourish, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 4:3 --out-dir "$W4" --out-prefix birthday

mmx --prompt "A single cream paper sleeve on a clean surface, the sleeve has an oxblood mark on the front, contemporary editorial photograph, soft daylight, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix package
mmx --prompt "A small cream paper sleeve on a clean surface, an oxblood mark on the front, contemporary editorial, soft daylight, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix package

mmx --prompt "A wide clean composition with a single small cream programme in the center-left, an oxblood mark in the corner, the rest of the composition is clean negative space, soft daylight, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix og
mmx --prompt "A wide clean editorial composition with a single small oxblood mark in the center, soft daylight, minimal, no other text" \
    --aspect-ratio 16:9 --out-dir "$W4" --out-prefix og

mmx --prompt "A small cream paper programme with an oxblood mark in the corner, sitting on a clean surface, soft window light from the side, contemporary editorial photograph, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix supporting
mmx --prompt "An editorial close-up of an oxblood mark on cream paper, soft daylight, contemporary, minimal, no other text" \
    --aspect-ratio 1:1 --out-dir "$W4" --out-prefix supporting

echo "=== W3 and W4 done ==="
