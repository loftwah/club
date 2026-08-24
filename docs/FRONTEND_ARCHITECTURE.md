# Frontend architecture

Plans With You uses Astro as the semantic application shell. Public pages are
server-rendered Astro; JavaScript is added only for a meaningful stateful
interaction. The architecture escalation order is:

```text
semantic HTML → modern CSS → Motion → ThreeUI / Three.js
```

## Current production shape

- `src/layouts/Base.astro` owns metadata, global navigation, the responsive
  native-disclosure menu, the footer, and the design-direction contract.
- `src/styles/global.css` imports Tailwind CSS 4 as the design-system compiler,
  declares shared CSS-first tokens, loads self-hosted Fontsource faces, and
  provides resilient operational/portal primitives.
- Public routes remain independent Astro documents. Route-scoped CSS is used
  for distinctive editorial compositions while consuming global semantic
  tokens.
- `src/components/plan-lifecycle/PlanLifecycle.tsx` is rendered to HTML on the
  server with no hydration. React provides a typed semantic component boundary,
  not an SPA.
- `src/styles/app-surfaces.css` is scoped to member and operator surfaces.
- `/internal/visual-lab/` is available on loopback and requires an operator
  session on deployed hosts. Older brand labs have the same boundary.

No production page imports ThreeUI or Three.js. The package is pinned for
isolated research, but the current signature lifecycle is smaller, clearer and
more accessible as semantic HTML and CSS.

## Rendering and data truth

D1 remains authoritative. Pages may render a zero/empty state when bindings are
unavailable; they may not invent member, event, venue, booking or business
facts. Public counters come from D1 and explicitly say when no completed record
exists. Illustrative plan objects are labelled as illustrations and never imply
a real booking or partnership.

Public routes may be indexed. Portal, admin, onboarding, internal labs and APIs
are excluded from `robots.txt`; authenticated surfaces also receive private,
no-store and noindex response headers in middleware.

## Client code admission test

A client island must answer all of these:

1. What state or interaction cannot be expressed well in HTML and CSS?
2. What is the no-JavaScript experience?
3. What is the reduced-motion experience?
4. When does it hydrate, pause and dispose?
5. Which performance budget does it consume?
6. Does it preserve the same semantic information outside the visual layer?

If those answers are weak, keep the feature server-rendered.

## Responsive and accessibility baseline

- Minimum supported layout width: 320 CSS pixels; QA baseline: 390 pixels.
- WCAG 2.2 AA is the target.
- Essential information and actions remain in DOM order.
- Focus-visible styles are global; touch actions are at least approximately 44
  CSS pixels where practical.
- Reduced motion removes transitions without replacing the interface with an
  inferior fallback.
- Tables scroll or become labelled cards on small screens.
- Print removes navigation/action controls and keeps semantic content.

## Release checks

Run `mise run acceptance`. The frontend-specific evidence includes typecheck,
browser routes, mobile overflow, axe, reduced motion, a clean production build,
the bundle budget, screenshots, and the design-contract seed in compiled HTML.
