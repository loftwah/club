# Commercial video production

> Verified: 2026-08-24. Source code is in `video/`; local render tooling is in
> `scripts/video/`; the canonical inventory is `creative/video-inventory.json`.

## Toolchain and licensing

All `remotion` and `@remotion/*` packages are pinned to stable `4.0.516`; Zod is
pinned to the compatible `4.4.3`. Do not mix versions or adopt alpha/canary
releases. Verify with `pnpm exec remotion versions`.

Remotion is source-available rather than OSI open source. Current free
commercial use covers individuals and organisations with up to three people;
larger organisations and qualifying automated rendering require the appropriate
licence. Recheck the [licence FAQ](https://www.remotion.dev/docs/license/faq)
before team size or render automation changes. Codec patent licensing is
separate.

The initial renderer is local Remotion Studio/CLI. Cloudflare Workers are not a
Chromium rendering runtime. Cloudflare Containers remain an incomplete beta
path; Lambda is deferred until render volume justifies its infrastructure and
licensing cost.

## Commands

```sh
mise run video:studio
mise run video:status
mise run video:render:all
mise run video:storyboard
mise run video:qc
mise run video:publish
```

`video:status` is the operational truth: each canonical campaign/format is
`CURRENT`, `STALE`, or `MISSING`. A source fingerprint includes motion source,
fonts, generated audio, render settings, exact package resolution, brand
configuration, and `DESIGN.md`. Canonical rendering refuses dirty source so
the recorded commit is meaningful. A render is `CURRENT` only when its
fingerprint matches, it is approved, and both master and delivery locations
exist.

## Studio and source structure

Studio is the design lab, grouped into primitives, scenes, campaigns,
landscape/vertical compositions, and QA/safe zones. The current physical-paper
system deliberately uses inspectable component-local styles rather than
Tailwind; the researched Tailwind 4 integration is not wired or claimed.
All time comes from deterministic Remotion frames. Never use CSS transitions,
CSS animations, timers, or real-time animation loops for rendered motion.

Vertical is separately art-directed, not cropped. Use larger typography, fewer
simultaneous objects, central hierarchy, faster payoff, and versioned UI-safe
overlays. Safe-zone overlays are development aids and must never be enabled in
approved outputs.

## Render products

Each canonical composition produces:

- ProRes 422 HQ `.mov` archival master with PCM audio;
- H.264 `.mp4` delivery with AAC 48 kHz/192 kbps audio;
- poster;
- retrieval thumbnail;
- contact sheet;
- render manifest and QC record.

ProRes is not a browser delivery format. H.264 remains the common compatible
delivery baseline. The deterministic render manifest records composition,
props/default profile, dimensions, fps, source commit/fingerprint, Remotion
version, audio profile, hashes, and render time.

## Social delivery profiles

Canonical vertical delivery is `1080×1920`, 9:16, 30 fps, H.264/AAC, and under
30 seconds. This is a current cross-platform working profile, not an eternal
universal spec.

- TikTok Studio currently accepts MP4/WebM at 720×1280 or higher. Ad placement
  rules differ, and TikTok directs advertisers to its preview tool.
- Instagram Reels API guidance currently recommends 9:16, H.264/HEVC, AAC
  48 kHz, 23–60 fps, and no more than 25 Mbps video / 128 kbps audio.
- Facebook Reels API guidance currently requires exact 9:16, at least 540×960,
  at least 23 fps, and 4–60 seconds.

TikTok/Meta do not provide one permanent numeric safe rectangle across every
placement, caption length, device, and account. The `social-ui-variable-v1`
overlay therefore documents conservative assumptions and the last verification
date; final files must still be checked in the platform preview tools. Official
starting points: [TikTok in-feed](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en),
[Meta Reels](https://www.facebook.com/business/ads/facebook-instagram-reels-ads),
[Instagram publishing](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api),
[Facebook publishing](https://www.postman.com/meta/facebook/folder/simabyk/reels-publishing).

## Audio and rights

Audio is generated offline through the operator-authorised ElevenLabs key; the
public Worker never receives that key or depends on ElevenLabs. Generated foley
and the sonic bed are normalised to 48 kHz with FFmpeg. Prompts, model,
generation time, rights basis, usage, and post-processing live in
`video/assets/audio-provenance.json`. Recheck the account's commercial terms
before reusing outputs outside these campaigns. The videos remain completely
understandable muted.

## R2 library

Heavy outputs never enter Git. After technical QC and independent approval,
`video:publish` writes versioned objects below:

```text
r2://social-club-artifacts/creative/approved/<asset-id>/<source-fingerprint>/
```

It also publishes the canonical inventory. The protected operator route
`/admin/creative/` retrieves approved delivery files, masters, posters, and
contact sheets. Private member artefacts must never share this public-marketing
prefix or retrieval path.
