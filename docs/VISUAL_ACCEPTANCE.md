# Visual acceptance protocol

Visual acceptance is evidence, not a subjective final glance.

## Route matrix

At minimum inspect `/`, `/how-it-works/`, `/membership/`, `/correspondence/`,
`/chapters/`, `/journal/`, `/faq/`, `/waiting-list/`, `/portal/login/`, the
authenticated member home, and every admin queue class.

Capture at:

- 1440×1000 desktop;
- 1024×768 compact desktop/tablet;
- 390×844 mobile;
- 320×568 minimum-width stress test where practical;
- reduced motion and increased contrast preferences.

## Pass conditions

- No horizontal document overflow.
- Primary proposition and truthful action are visible in the first viewport.
- Navigation works without JavaScript and keyboard focus remains visible.
- No hidden, clipped or overlapping headings, controls, tables or status copy.
- All text/background pairs meet WCAG 2.2 AA; bright signal colour uses dark
  text or is non-text.
- Forms have persistent labels, useful errors and a live status region.
- Empty, loading, failure, escalation and terminal states are visually distinct.
- Illustrative fixtures are labelled; no fake real-world claims appear.
- Reduced-motion output remains composed and complete.
- Axe has no serious/critical violations on the sampled routes.
- The compiled homepage contains design seed `2a9e769e`.
- The approved comp is used as direction, not shipped as flattened UI.

Two implementation screenshot rounds are the normal limit. If a core mechanism
is still wrong after round two, return to structure rather than polishing the
same weak composition.

## Release evidence

Store the final screenshots or review references with the release record. The
handoff reports browser viewports, overflow results, accessibility findings,
bundle results, known visual limitations and any route not exercised with real
authenticated data.
