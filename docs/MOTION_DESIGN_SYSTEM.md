# Plans With You motion design system

Verified 24 August 2026 against Remotion `4.0.516`. This document defines the
creative grammar; `docs/VIDEO_PRODUCTION.md` owns rendering and publishing, and
`docs/VIDEO_ACCEPTANCE.md` owns approval.

## Creative position

Motion behaves like a calm administrative object becoming physical. The shared
language is paper, dates, registration rules, cobalt schedule pressure,
vermilion cancellation, correspondence, and stable membership. It must not
drift into fake heritage, wax-seal luxury, generic SaaS kinetic type, or random
3D spectacle.

The two canonical routes are deliberately different:

- **The Plan** makes the mechanic legible: invitation, scheduled reality,
  approach, successful cancellation, relief.
- **The Relationship** shows continuity without compulsory participation:
  correspondence gathers, membership stays stable, and welcome care may mark
  time without demanding attention.

## Motion grammar

| Meaning              | Motion behaviour                                                         |
| -------------------- | ------------------------------------------------------------------------ |
| Invitation arrives   | Gentle vertical travel, quick paper settle, immediate legibility.        |
| Plan becomes real    | Decisive placement and cobalt registration; stable apparent mass.        |
| Date approaches      | Controlled rising pressure; no alarm or panic language.                  |
| Cancellation fulfils | Fast tactile strike and vermilion mark; satisfying success, never error. |
| Relief               | Pressure drops, space opens, dark close settles confidently.             |
| Correspondence       | Slide, reveal, slight material variation, then accumulate.               |
| Membership           | Tangible and still; identity does not depend on activity.                |
| Milestone            | Restrained mark of time; no confetti and no universal gift promise.      |

All motion is a pure function of Remotion frames. Springs use high damping and
consistent mass; interpolation clamps at both ends. CSS animation,
browser-time transitions, timers, and real-time render loops are forbidden.

## Source architecture

`video/root.tsx` registers Studio folders for primitives, scenes, both
campaigns, native landscape/vertical cuts, and safe-zone QA. Typed Zod props in
`video/types.ts` expose copy, CTA, format, audio and versioned safe-zone
profiles without forcing the four compositions into one responsive timeline.

Reusable primitives include the invitation, calendar date, cancellation mark,
envelope/letter, membership card, milestone, status, CTA, end card, lockup, and
safe-zone overlay. Scenes compose those objects; campaign files own timing and
sound cues. Campaign files should remain readable as edit decisions in Studio.

## Typography and material

Archivo, Source Serif 4 and Fragment Mono are stored locally in
`public/video/fonts` and loaded through `staticFile()`. Important copy is real
HTML text. Generated imagery is never used for words, logos, member records, or
administrative data. Demonstration identifiers are visibly labelled `SAMPLE`.

Component-local frame styles are intentional for this compact physical-paper
system: they keep each designed object directly inspectable in Studio. The
official Tailwind 4 integration was researched but is not wired or claimed.

Programmatic HTML/CSS and SVG are the current graphic stack. Remotion shapes,
paths, noise, canvas effects, motion blur, and `@remotion/three` remain available
only when a scene gains meaning from them. The canonical films currently avoid
3D and heavy effects because legible paper objects outperform ornamental depth;
this is a product judgement, not a missing installation.

## Native formats and safe zones

Landscape is `1920×1080`; vertical is `1080×1920`. Vertical has its own 16-second
pacing, larger hierarchy, fewer simultaneous objects, and conservative 10% top
and bottom / 8% side clearance. Persistent rails, footers and the end card sit
inside that boundary.

`social-ui-variable-v1` and `landscape-editorial-v1` record aspect, sources,
verification date and assumptions in `video/types.ts`. They are development QA
profiles, not eternal platform geometry. Overlays default off and must never be
present in final renders; placement preview tools remain part of publishing.

## Sound

Sound is designed offline with the operator-authorised ElevenLabs account and
normalised through FFmpeg. The vocabulary is paper arrival, calendar placement,
correspondence, a firm cancellation strike, restrained milestone tone, and a
minimal mechanical/paper bed. Full source cues play rather than being clipped
by sequence windows, and the bed receives a designed end fade.

`video/assets/audio-provenance.json` records provider, prompts, dates, rights
basis, use and post-processing. The public Worker never receives the
ElevenLabs key. Every film remains complete and understandable when muted.
