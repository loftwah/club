#!/bin/bash
# Continue generation from W2 (only 2/16 done).
# Run in background with longer timeout.

ROOT="/Users/deanlofts/gits/club"
W2="$ROOT/explorations/brand/r2-assets/w2"

mmx() {
  /Users/deanlofts/.cache/npm/global/bin/mmx image generate --quiet "$@"
}

echo "=== World 2: In The Post (continuation) ==="

mmx --prompt "A small cream envelope on warm wood, a small hand-drawn mark in the corner, soft warm window light, contemporary editorial photograph, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix hero

mmx --prompt "A small cream card on warm wood, a hand-drawn mark and a small drawn flourish, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix invite

mmx --prompt "A single cream paper card on warm wood, a hand-written mark and a small drawn flourish, soft warm window light, contemporary editorial, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix cancel

mmx --prompt "A small cream card on warm wood, a hand-drawn mark in the corner, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix cancel

mmx --prompt "A small warm-paper card on warm wood, a hand-drawn mark in the corner, soft warm window light, contemporary editorial photograph, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix card

mmx --prompt "A small warm-paper card on warm wood, a hand-drawn mark in the corner, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix card

mmx --prompt "A single small cream paper card with a hand-written mark and a small drawn flourish at the bottom, on warm wood, soft warm window light, contemporary editorial, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix birthday

mmx --prompt "A small cream card with a hand-drawn mark, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 4:3 --out-dir "$W2" --out-prefix birthday

mmx --prompt "A single unbleached paper sleeve on warm wood, a small hand-drawn mark on the front, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix package

mmx --prompt "A small unbleached paper sleeve on warm wood, a hand-drawn mark on the front, soft warm window light, contemporary editorial photograph, no other text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix package

mmx --prompt "A wide warm composition with a single cream envelope on warm wood in the center-left, the envelope has a small hand-drawn mark, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix og

mmx --prompt "A wide warm composition with a single cream paper card on warm wood, soft warm window light, contemporary editorial, no other text" \
    --aspect-ratio 16:9 --out-dir "$W2" --out-prefix og

mmx --prompt "A small cream paper letter on warm wood, a hand-written mark and a small drawn flourish, soft warm window light, contemporary editorial photograph, no readable text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix supporting

mmx --prompt "A close-up of a hand-written mark on cream paper, soft warm window light, contemporary editorial, minimal, no readable text" \
    --aspect-ratio 1:1 --out-dir "$W2" --out-prefix supporting

echo "=== W2 done ==="
