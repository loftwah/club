// Issue #6: deterministic route/state/viewport manifest.
//
// This file is the single typed source of truth for the visual
// suite. Both the geometry collector (#7) and the visual
// regression suite (#8) iterate the same entries so the
// canonical viewport matrix, the route inventory and the
// per-surface readiness signal are never duplicated by hand.
//
// Authoring rules:
//
//   1. Do not list the same route twice. State variants of the
//      same route must be expressed as separate entries sharing
//      the same path but a different state ID.
//   2. Every `setup` that requires local data must be honoured
//      by the test runner before the page is rendered; the
//      `visual-fixtures.ts` helper applies the matching fixture
//      (member / onboarding / operator) and obtains a real
//      magic-link session through the normal /api/portal/login
//      flow. No production auth bypass is allowed.
//   3. The onboarding step entries are generated from
//      ONBOARDING_STEPS so a new step cannot silently bypass
//      visual QA.
//   4. The completeness guard (tests/browser/visual/completeness.spec.ts)
//      fails when a new .astro page under the listed
//      namespaces is added without an intentional manifest
//      decision. The allowlist at the bottom of this file is
//      the only place API/internal routes are excluded.

import { ONBOARDING_STEPS } from "../../../src/services/onboarding";
import { listChapters } from "../../../src/lib/chapters";

export interface Viewport {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export const VISUAL_VIEWPORTS = {
  desktop: { id: "desktop", width: 1440, height: 1000 },
  compact: { id: "compact", width: 1024, height: 768 },
  boundary: { id: "boundary", width: 768, height: 1024 },
  mobile: { id: "mobile", width: 390, height: 844 },
  minimum: { id: "minimum", width: 320, height: 568 },
} as const satisfies Record<string, Viewport>;

export type VisualViewportId = keyof typeof VISUAL_VIEWPORTS;

const ALL_VIEWPORTS: ReadonlyArray<VisualViewportId> = [
  "desktop",
  "compact",
  "boundary",
  "mobile",
  "minimum",
];

export type VisualAuth = "public" | "member" | "onboarding" | "operator";

export type VisualSetup = "none" | "member" | "onboarding" | "operator";

export interface VisualReadySignal {
  /** A selector that must be present and visible. */
  readonly selector?: string;
  /** A heading text or pattern that must be visible. */
  readonly heading?: string | RegExp;
  /** A URL substring the page must NOT redirect away from. */
  readonly urlIncludes?: string;
}

export interface VisualSurface {
  readonly id: string;
  readonly path: string;
  readonly auth: VisualAuth;
  readonly setup: VisualSetup;
  /** Optional state label for variants of the same path. */
  readonly state?: string;
  readonly viewports: ReadonlyArray<VisualViewportId>;
  readonly ready: VisualReadySignal;
  readonly snapshot: boolean;
  readonly geometry: boolean;
  /** Optional per-surface label used in the artefact filename. */
  readonly label?: string;
}

// ---------------------------------------------------------------------------
// Public surfaces
// ---------------------------------------------------------------------------

const PUBLIC_SURFACES: ReadonlyArray<VisualSurface> = [
  {
    id: "home",
    path: "/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { selector: ".dispatch-hero h1" },
    snapshot: true,
    geometry: true,
  },
  {
    id: "how-it-works",
    path: "/how-it-works/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /How it works/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "membership",
    path: "/membership/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Membership/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "correspondence",
    path: "/correspondence/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Correspondence/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "chapters",
    path: "/chapters/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Chapters/i },
    snapshot: true,
    geometry: true,
  },
  // Chapter detail variants are derived from the canonical
  // chapter catalogue (`listChapters()`) so a newly configured
  // non-Australian chapter is automatically picked up. The
  // catalogue is the single source of truth; do not hard-code
  // slugs here.
  ...listChapters().map<VisualSurface>((chapter) => ({
    id: `chapters-${chapter.slug}`,
    path: `/chapters/${chapter.slug}/`,
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: new RegExp(chapter.name, "i") },
    snapshot: true,
    geometry: true,
  })),
  {
    id: "journal",
    path: "/journal/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Notes from the schedule|Journal/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "faq",
    path: "/faq/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /The short answers|FAQ/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "faq-answer-open",
    path: "/faq/",
    auth: "public",
    setup: "none",
    state: "answer-open",
    viewports: ["desktop", "mobile"],
    ready: { selector: ".pwy-faq-list details[open]" },
    snapshot: true,
    geometry: true,
  },
  {
    id: "waiting-list",
    path: "/waiting-list/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { selector: "form#wl-form" },
    snapshot: true,
    geometry: true,
  },
  {
    id: "waiting-list-chapter",
    path: "/waiting-list/?chapter=melbourne",
    auth: "public",
    setup: "none",
    state: "chapter-selected",
    viewports: ["desktop", "mobile"],
    ready: { selector: "form#wl-form" },
    snapshot: true,
    geometry: true,
  },
  {
    id: "waiting-list-tier-and-chapter",
    path: "/waiting-list/?tier=deluxe&chapter=melbourne",
    auth: "public",
    setup: "none",
    state: "tier-and-chapter-selected",
    viewports: ["desktop", "mobile"],
    ready: { selector: "form#wl-form" },
    snapshot: true,
    geometry: true,
  },
  {
    id: "privacy",
    path: "/privacy/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Privacy/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "terms",
    path: "/terms/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Terms/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "not-found",
    path: "/__pwy-nonexistent-path__/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /not on the schedule|not found/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "portal-login",
    path: "/portal/login/",
    auth: "public",
    setup: "none",
    viewports: ALL_VIEWPORTS,
    ready: { selector: "form" },
    snapshot: true,
    geometry: true,
  },
];

// ---------------------------------------------------------------------------
// Member surfaces
// ---------------------------------------------------------------------------

const MEMBER_SURFACES: ReadonlyArray<VisualSurface> = [
  {
    id: "portal-home",
    path: "/portal/",
    auth: "member",
    setup: "member",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Portal|Welcome|Hi/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "portal-preferences",
    path: "/portal/preferences/",
    auth: "member",
    setup: "member",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Preferences/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "portal-memory",
    path: "/portal/memory/",
    auth: "member",
    setup: "member",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /What we remember|Memory/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "portal-commitments",
    path: "/portal/commitments/",
    auth: "member",
    setup: "member",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Commitment/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "portal-appearance",
    path: "/portal/appearance/",
    auth: "member",
    setup: "member",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Appearance/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "portal-account-delete",
    path: "/portal/account/delete/",
    auth: "member",
    setup: "member",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Delete account|Account/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "portal-club-meetings",
    path: "/portal/club-meetings/",
    auth: "member",
    setup: "member",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Club Meeting/i },
    snapshot: true,
    geometry: true,
  },
];

// ---------------------------------------------------------------------------
// Onboarding surfaces — generated from ONBOARDING_STEPS.
// ---------------------------------------------------------------------------

function onboardingSurfaces(): ReadonlyArray<VisualSurface> {
  return ONBOARDING_STEPS.map((s) => ({
    id: `onboarding-${s.id}`,
    path: `/onboarding/${s.id}/`,
    auth: "onboarding",
    setup: "onboarding",
    viewports: ALL_VIEWPORTS,
    ready: { selector: "h1" },
    snapshot: s.id === "identity" || s.id === "post" || s.id === "terms" || s.id === "payment-gate",
    geometry: true,
  }));
}

// ---------------------------------------------------------------------------
// Operator surfaces
// ---------------------------------------------------------------------------

const OPERATOR_SURFACES: ReadonlyArray<VisualSurface> = [
  {
    id: "admin-home",
    path: "/admin/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /What needs my attention|Admin|Operator/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "admin-operations",
    path: "/admin/operations/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Operations/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "admin-tasks",
    path: "/admin/tasks/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Tasks/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "admin-inbound",
    path: "/admin/inbound/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Inbound/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "admin-events",
    path: "/admin/events/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Events/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "admin-members",
    path: "/admin/members/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Members/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "admin-appearance",
    path: "/admin/appearance/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Appearance/i },
    snapshot: true,
    geometry: true,
  },
  {
    id: "admin-creative",
    path: "/admin/creative/",
    auth: "operator",
    setup: "operator",
    viewports: ALL_VIEWPORTS,
    ready: { heading: /Creative/i },
    snapshot: true,
    geometry: true,
  },
];

// ---------------------------------------------------------------------------
// Aggregate manifest
// ---------------------------------------------------------------------------

export const VISUAL_SURFACES: ReadonlyArray<VisualSurface> = [
  ...PUBLIC_SURFACES,
  ...MEMBER_SURFACES,
  ...onboardingSurfaces(),
  ...OPERATOR_SURFACES,
];

/**
 * Routes that are deliberately not part of the visual manifest.
 * API endpoints, internal tooling, the sitemap, the robots
 * endpoint and explicitly non-product surfaces belong here. New
 * rendered surfaces under the product namespaces fail the
 * completeness guard unless intentionally listed.
 */
export const VISUAL_MANIFEST_ALLOWLIST: ReadonlyArray<string> = [
  // Astro / infrastructure
  "src/pages/404.astro",
  "src/pages/robots.txt.ts",
  "src/pages/sitemap.xml.ts",
  // Brand exploration
  "src/pages/brand-explorer.astro",
  "src/pages/brand-r2.astro",
  // Operator creative details (deterministic asset id surface)
  "src/pages/admin/creative/",
  // API + OG (rendered as data, not as product surfaces)
  "src/pages/api/",
  "src/pages/og/",
  // Internal non-product tooling
  "src/pages/internal/",
];
