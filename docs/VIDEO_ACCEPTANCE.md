# Commercial video acceptance

Successful rendering is not approval. The terminal question is:

> Would we publish this exact file today without opening an editor?

If the answer is no and the problem is actionable, the video remains stale.

## Canonical inventory

- The Plan / 1920×1080 / 16:9
- The Plan / 1080×1920 / 9:16
- The Relationship / 1920×1080 / 16:9
- The Relationship / 1080×1920 / 9:16

The Plan must explain the product immediately. The Relationship must establish
ongoing belonging without compulsory participation and must not be a reskinned
version of The Plan.

## Technical gate

`mise run video:qc` must pass resolution, aspect, 30 fps, container, H.264/AAC
delivery, 48 kHz audio, duration, file presence, and black-frame checks. Manual
inspection must also confirm:

- correct embedded fonts, product name, copy, CTA, and URL;
- first and last frame are intentional;
- no clipping, unsafe text, tiny orphan lines, or platform-UI collisions;
- no debug/safe-zone overlays in final output;
- no flicker, nondeterministic frames, broken transitions, or black accidents;
- no clipped/distorted sound, abrupt audio cut, or foley detached from action;
- full comprehension when muted.

Inspect full videos, representative stills, posters, and contact sheets. Do not
approve from code or a single hero frame.

## Art-direction scorecard

Score each category 1–5:

| Category                      | Blocking definition                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Concept and hook              | Product is not interesting or legible in the opening seconds.                           |
| Product clarity               | Cancellation reads as error/failure, or relationship value is vague.                    |
| Art direction and composition | Generic template, weak hierarchy, accidental framing, or dead space.                    |
| Typography                    | Poor fit, fallback, wrapping, rhythm, or unsafe placement.                              |
| Motion and physicality        | Weightless, floaty, over-eased, arbitrary, or mechanically repetitive.                  |
| Pacing                        | Slow logo-first opening, rushed copy, or scenes without breathing room.                 |
| Sound                         | Generic stock bed, weak cancellation impact, poor mix, or dependence on audio.          |
| Brand distinctiveness         | Fake heritage, generic SaaS, or visual language unrelated to scheduling/correspondence. |
| Native vertical quality       | Looks cropped, overfull, caption-obscured, or platform-inappropriate.                   |
| Commercial readiness          | Requires editing rescue or still smells generated/templated.                            |

Any score below 4 blocks approval. `AI/template smell` is reverse-scored: 5
means no detectable smell. Record exact timecodes/frames and repair findings in
one coherent batch.

## Approval chain

1. Technical QC passes.
2. A fresh reviewer inspects landscape, vertical, audio, and muted playback.
3. Findings are fixed as a batch and the affected outputs are rerendered.
4. A fresh second look confirms no blocking category remains.
5. `scripts/video/approve.mjs --all --review=<review-file>` records approval.
6. Publish to R2 and verify `mise run video:status` reports all four `CURRENT`.
