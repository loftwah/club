# ThreeUI scene decision

ThreeUI `0.3.0` was inspected component by component. The earlier homepage
loaded the package barrel, emitted a 6.91 MB minified / 3.26 MB gzip chunk, and
rendered an effectively empty canvas. That path has been removed.

## Current verdict

No ThreeUI scene is used in production. The central plan lifecycle is more
legible, faster and more accessible as semantic HTML and CSS. The production
build's largest client asset is now approximately 45 KiB gzip.

## Shortlist for future isolated experiments

1. Predictive arc mechanics as inspiration for an invitation-to-cancellation
   path; likely reimplemented locally rather than importing the package scene.
2. Bookshelf/archive mechanics for an optional correspondence archive, only
   after route-splitting and mobile benchmarking.
3. Small generative field/tree treatments for non-essential milestones, only
   when they express real accumulation.

EngravedCertificate is rejected: it carries fixed unsuitable copy and points
back toward the faux-heritage visual world. The package also contains mixed
Three.js version assumptions, so any adopted scene must be isolated and proven
against a single compatible renderer.

## Admission and capability tiers

Every scene needs a written product mapping, direct/local import, licence and
asset audit, geometry/texture budget, renderer DPR cap, pause/disposal logic,
keyboard/reduced-motion/static experience, mobile measurements, and a bundle
report.

- **High:** full scene on capable devices after deliberate user action.
- **Medium:** reduced geometry/material/texture/DPR.
- **Static:** excellent HTML/CSS representation with identical meaning.

The base public route remains under 150 KiB gzip. An optional scene has a 500
KiB gzip hard ceiling and must not block LCP.
