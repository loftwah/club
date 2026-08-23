#!/bin/bash
# W4 remaining: birthday, package, og, supporting (4 slots x 2 = 8 images)

ROOT="/Users/deanlofts/gits/club"
W4="$ROOT/explorations/brand/r2-assets/w4"

mmx() {
  /Users/deanlofts/.cache/npm/global/bin/mmx image generate --quiet "$@"
}

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

echo "=== W4 done ==="
