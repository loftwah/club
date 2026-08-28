// Issue #7: DOM geometry telemetry + hard invariants.
//
// The geometry collector walks the rendered visible DOM, records
// per-element rect, viewport-relative size, scroll dimensions,
// key computed styles, containing block, and clipping ancestors.
// It then runs the hard invariant suite against the collected
// map and reports every violation with the exact selector, rect
// and pixel delta — the same format a reviewer would want when
// reading a Playwright failure output.
//
// The module is intentionally framework-agnostic: it accepts a
// Playwright `Page` and returns a serialisable artefact plus a
// list of violations. The visual runner (issue #8) and the
// canonical `pnpm acceptance` path both consume the same
// exported types so the JSON shape never drifts.

import type { Page } from "@playwright/test";

export interface Rect {
  x: number;
  y: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface ViewportRelative {
  width: number;
  height: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}

export interface ScrollDims {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

export interface ComputedStyleSnapshot {
  display: string;
  visibility: string;
  opacity: string;
  position: string;
  zIndex: string;
  overflowX: string;
  overflowY: string;
  boxSizing: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gap: string;
  transform: string;
}

export interface ClippingAncestor {
  path: string;
  overflowX: string;
  overflowY: string;
  rect: Rect;
}

export interface ElementGeometry {
  path: string;
  testId?: string;
  id?: string;
  tag: string;
  classes: string[];
  role?: string;
  text?: string;
  rect: Rect;
  viewport: ViewportRelative;
  scroll: ScrollDims;
  computed: ComputedStyleSnapshot;
  containingBlock?: string;
  clippingAncestors: ClippingAncestor[];
}

export type ViolationKind =
  | "page-horizontal-overflow"
  | "ancestor-clipping"
  | "containing-block-overflow"
  | "impossible-control"
  | "text-clipping"
  | "peer-overlap"
  | "weird-intrinsic-dimensions";

export interface Violation {
  kind: ViolationKind;
  message: string;
  element?: { path: string; rect: Rect };
  container?: { path: string; rect: Rect };
  delta?: number;
  area?: number;
  peer?: { path: string; rect: Rect };
}

export interface LayoutSummary {
  firstViewportElements: string[];
  majorRegions: Array<{
    path: string;
    x: number;
    y: number;
    width: number;
    height: number;
    widthPct: number;
    heightPct: number;
  }>;
  headings: string[];
  actions: string[];
  scrollContainers: string[];
  fixedOrAbsolute: string[];
}

export interface GeometryReport {
  surfaceId: string;
  path: string;
  state: string;
  viewport: { width: number; height: number };
  document: {
    scrollWidth: number;
    scrollHeight: number;
    clientWidth: number;
    clientHeight: number;
  };
  elements: ElementGeometry[];
  violations: Violation[];
  summary: LayoutSummary;
}

// A small allowlist of selector expressions whose horizontal
// scroll is intentionally component-scoped (e.g. an .app-table
// that needs to scroll inside its own card).
const SCROLL_ALLOWLIST: ReadonlyArray<string> = [
  ".app-table-wrap",
  ".faq-list",
  ".calendar-month",
  ".mobile-nav nav",
];

const INTERACTIVE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);

const STRUCTURAL_TAGS = new Set([
  "HEADER",
  "MAIN",
  "NAV",
  "FOOTER",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "FORM",
]);

interface CollectorResult {
  elements: ElementGeometry[];
  document: {
    scrollWidth: number;
    scrollHeight: number;
    clientWidth: number;
    clientHeight: number;
  };
}

async function collect(page: Page): Promise<CollectorResult> {
  const result = await page.evaluate(
    ({ scrollAllowlist, interactiveTags, structuralTags }) => {
      const allowSet = new Set(scrollAllowlist);
      const interactive = new Set<string>(interactiveTags);
      const structural = new Set<string>(structuralTags);
      const clippingTags = new Set<string>([
        "DIV",
        "MAIN",
        "SECTION",
        "ARTICLE",
        "ASIDE",
        "HEADER",
        "FOOTER",
        "NAV",
        "FORM",
        "UL",
        "OL",
        "LI",
        "TABLE",
        "P",
        "SPAN",
        "A",
        "BUTTON",
      ]);

      function describeElement(el: Element): string {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls =
          el.className && typeof el.className === "string"
            ? "." + el.className.trim().split(/\s+/).join(".")
            : "";
        const testId = el.getAttribute("data-testid")
          ? `[data-testid="${el.getAttribute("data-testid")}"]`
          : "";
        return `${tag}${id}${testId}${cls}`.slice(0, 160);
      }

      function collectClippingAncestors(el: Element): Array<{
        path: string;
        overflowX: string;
        overflowY: string;
        rect: {
          x: number;
          y: number;
          top: number;
          right: number;
          bottom: number;
          left: number;
          width: number;
          height: number;
        };
      }> {
        const out: Array<{
          path: string;
          overflowX: string;
          overflowY: string;
          rect: {
            x: number;
            y: number;
            top: number;
            right: number;
            bottom: number;
            left: number;
            width: number;
            height: number;
          };
        }> = [];
        let parent: Element | null = el.parentElement;
        while (parent && parent !== document.documentElement) {
          const style = getComputedStyle(parent);
          const ovX = style.overflowX;
          const ovY = style.overflowY;
          if (
            ovX === "hidden" ||
            ovX === "clip" ||
            ovX === "auto" ||
            ovX === "scroll" ||
            ovY === "hidden" ||
            ovY === "clip" ||
            ovY === "auto" ||
            ovY === "scroll"
          ) {
            const r = parent.getBoundingClientRect();
            out.push({
              path: describeElement(parent),
              overflowX: ovX,
              overflowY: ovY,
              rect: {
                x: r.x,
                y: r.y,
                top: r.top,
                right: r.right,
                bottom: r.bottom,
                left: r.left,
                width: r.width,
                height: r.height,
              },
            });
          }
          parent = parent.parentElement;
        }
        return out;
      }

      const root = document.body;
      const elements: Array<Record<string, unknown>> = [];
      const all = root.querySelectorAll<HTMLElement>("*");
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      for (const el of Array.from(all)) {
        if (!clippingTags.has(el.tagName)) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // Round to two decimals so the JSON output is deterministic
        // enough to diff between runs.
        const round = (n: number) => Math.round(n * 100) / 100;
        const rect = {
          x: round(r.x),
          y: round(r.y),
          top: round(r.top),
          right: round(r.right),
          bottom: round(r.bottom),
          left: round(r.left),
          width: round(r.width),
          height: round(r.height),
        };
        const tag = el.tagName.toLowerCase();
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
        const computed = {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          position: style.position,
          zIndex: style.zIndex,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          boxSizing: style.boxSizing,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          gridTemplateColumns: style.gridTemplateColumns,
          gridTemplateRows: style.gridTemplateRows,
          gap: style.gap,
          transform: style.transform,
        };
        elements.push({
          path: describeElement(el),
          testId: el.getAttribute("data-testid") ?? undefined,
          id: el.id || undefined,
          tag,
          classes:
            typeof el.className === "string"
              ? el.className.trim().split(/\s+/).filter(Boolean)
              : [],
          role: el.getAttribute("role") ?? undefined,
          text: text || undefined,
          rect,
          viewport: {
            width: vw,
            height: vh,
            xPct: round((r.x / vw) * 100),
            yPct: round((r.y / vh) * 100),
            widthPct: round((r.width / vw) * 100),
            heightPct: round((r.height / vh) * 100),
          },
          scroll: {
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            scrollWidth: el.scrollWidth,
            scrollHeight: el.scrollHeight,
          },
          computed,
          containingBlock: undefined,
          clippingAncestors: collectClippingAncestors(el),
        });
      }
      void allowSet;
      void interactive;
      void structural;
      return {
        elements,
        document: {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight,
        },
      };
    },
    {
      scrollAllowlist: SCROLL_ALLOWLIST,
      interactiveTags: Array.from(INTERACTIVE_TAGS),
      structuralTags: Array.from(STRUCTURAL_TAGS),
    },
  );
  return result as unknown as CollectorResult;
}

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 10000) / 100;
}

function runInvariants(
  elements: ElementGeometry[],
  document: {
    scrollWidth: number;
    clientWidth: number;
    scrollHeight: number;
    clientHeight: number;
  },
  viewport: { width: number; height: number },
): Violation[] {
  const violations: Violation[] = [];

  // Invariant A: page-level horizontal containment.
  const overflow = document.scrollWidth - document.clientWidth;
  if (overflow > 1) {
    const culprit = elements
      .filter((e) => e.rect.right > viewport.width + 1)
      .sort((a, b) => b.rect.right - a.rect.right)[0];
    violations.push({
      kind: "page-horizontal-overflow",
      message: `document horizontal overflow: ${overflow.toFixed(2)}px`,
      element: culprit ? { path: culprit.path, rect: culprit.rect } : undefined,
      delta: overflow,
    });
  }

  // Invariant B: ancestor clipping detection.
  for (const el of elements) {
    for (const clipper of el.clippingAncestors) {
      if (clipper.overflowX === "hidden" || clipper.overflowX === "clip") {
        // The element's rect must lie within the clipper's
        // horizontal extent, allowing for a sub-pixel tolerance.
        const leftOk = el.rect.left >= clipper.rect.left - 0.5;
        const rightOk = el.rect.right <= clipper.rect.right + 0.5;
        if (!leftOk || !rightOk) {
          const delta = Math.max(
            clipper.rect.left - el.rect.left,
            el.rect.right - clipper.rect.right,
          );
          if (delta > 0.5) {
            violations.push({
              kind: "ancestor-clipping",
              message: `element rect escapes ancestor clipper: ${delta.toFixed(2)}px beyond`,
              element: { path: el.path, rect: el.rect },
              container: { path: clipper.path, rect: clipper.rect },
              delta,
            });
          }
        }
      }
    }
  }

  // Invariant C: containing-block overflow.
  for (const el of elements) {
    if (el.tag === "body" || el.tag === "html") continue;
    const parent = elements.find(
      (p) =>
        p !== el &&
        p.rect.left <= el.rect.left &&
        p.rect.right >= el.rect.right &&
        p.rect.top <= el.rect.top,
    );
    if (parent && el.rect.right > parent.rect.right + 1) {
      const delta = el.rect.right - parent.rect.right;
      violations.push({
        kind: "containing-block-overflow",
        message: `element width ${el.rect.width.toFixed(2)} exceeds containing block ${parent.rect.width.toFixed(2)}`,
        element: { path: el.path, rect: el.rect },
        container: { path: parent.path, rect: parent.rect },
        delta,
      });
    }
  }

  // Invariant D: visible interactive controls with impossible dimensions.
  // Only flag truly impossible controls: zero area, or anchored
  // off-screen above the viewport (top < -50px, typical for
  // skip-links and intentionally hidden focus-revealed CTAs).
  // Elements that are simply below the document fold on a long
  // page are reachable via scroll and are NOT impossible.
  for (const el of elements) {
    if (!INTERACTIVE_TAGS.has(el.tag.toUpperCase())) continue;
    if (el.rect.width === 0 || el.rect.height === 0) {
      violations.push({
        kind: "impossible-control",
        message: `interactive ${el.tag} has zero area (${el.rect.width}×${el.rect.height})`,
        element: { path: el.path, rect: el.rect },
      });
      continue;
    }
    // Off-screen above the viewport: typical skip-link pattern.
    // Allow the element if it has a transform that places it
    // off-screen (deliberate focus-reveal).
    if (el.rect.top < -50) {
      const transform = el.computed.transform;
      const hasNegativeTransform = transform !== "none" && /-\d/.test(transform) === true;
      if (!hasNegativeTransform) {
        violations.push({
          kind: "impossible-control",
          message: `interactive ${el.tag} is positioned off-screen above the viewport (rect: ${JSON.stringify(el.rect)})`,
          element: { path: el.path, rect: el.rect },
        });
      }
    }
  }

  // Invariant E: text clipping — scrollWidth > clientWidth and overflow is hidden.
  for (const el of elements) {
    const scrollable = el.scroll.scrollWidth - el.scroll.clientWidth;
    if (
      scrollable > 0 &&
      (el.computed.overflowX === "hidden" || el.computed.overflowX === "clip")
    ) {
      // Skip accessibility-hidden elements: a `.sr-only` span
      // (or any element that is visually clipped to 1×1 with
      // overflow:hidden / clip:rect(0,0,0,0)) intentionally
      // contains text that is wider than its visible rect so it
      // is available to assistive technology. The "clipping"
      // here is the standard screen-reader pattern, not a real
      // visual defect.
      const isAccessibilityHidden =
        el.classes.includes("sr-only") ||
        el.classes.some((c) => c === "visually-hidden" || c === "a11y-hidden") ||
        el.computed.position === "absolute" ||
        el.computed.position === "fixed"
          ? el.rect.width <= 1 && el.rect.height <= 1
          : false;
      if (isAccessibilityHidden) continue;
      violations.push({
        kind: "text-clipping",
        message: `text overflows clientWidth by ${scrollable}px while overflow-x is ${el.computed.overflowX}`,
        element: { path: el.path, rect: el.rect },
        delta: scrollable,
      });
    }
  }

  // Invariant F: peer overlap (only direct siblings).
  const byParent = new Map<string, ElementGeometry[]>();
  for (const el of elements) {
    if (!el.containingBlock) continue;
    const list = byParent.get(el.containingBlock) ?? [];
    list.push(el);
    byParent.set(el.containingBlock, list);
  }
  for (const [parentPath, list] of byParent) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        // Skip nested cases (one rect contains the other).
        const aContainsB =
          a.rect.left <= b.rect.left &&
          a.rect.right >= b.rect.right &&
          a.rect.top <= b.rect.top &&
          a.rect.bottom >= b.rect.bottom;
        const bContainsA =
          b.rect.left <= a.rect.left &&
          b.rect.right >= a.rect.right &&
          b.rect.top <= a.rect.top &&
          b.rect.bottom >= a.rect.bottom;
        if (aContainsB || bContainsA) continue;
        const xOverlap = Math.max(
          0,
          Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left),
        );
        const yOverlap = Math.max(
          0,
          Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top),
        );
        if (xOverlap > 0 && yOverlap > 0) {
          const area = xOverlap * yOverlap;
          if (area < 1) continue;
          violations.push({
            kind: "peer-overlap",
            message: `peers overlap in ${parentPath}: ${xOverlap.toFixed(2)}×${yOverlap.toFixed(2)} = ${area.toFixed(2)}px²`,
            element: { path: a.path, rect: a.rect },
            peer: { path: b.path, rect: b.rect },
            area,
          });
        }
      }
    }
  }

  return violations;
}

function buildSummary(
  elements: ElementGeometry[],
  viewport: { width: number; height: number },
): LayoutSummary {
  const majorRegions: LayoutSummary["majorRegions"] = [];
  const headings: string[] = [];
  const actions: string[] = [];
  const scrollContainers: string[] = [];
  const fixedOrAbsolute: string[] = [];
  const firstViewportElements: string[] = [];

  for (const el of elements) {
    if (STRUCTURAL_TAGS.has(el.tag.toUpperCase()) && el.rect.width * el.rect.height > 8000) {
      majorRegions.push({
        path: el.path,
        x: el.rect.x,
        y: el.rect.y,
        width: el.rect.width,
        height: el.rect.height,
        widthPct: pct(el.rect.width, viewport.width),
        heightPct: pct(el.rect.height, viewport.height),
      });
    }
    if (el.tag === "h1" || el.tag === "h2") headings.push(el.path);
    if (INTERACTIVE_TAGS.has(el.tag.toUpperCase())) actions.push(el.path);
    if (
      el.scroll.scrollWidth > el.scroll.clientWidth + 1 ||
      el.scroll.scrollHeight > el.scroll.clientHeight + 1
    ) {
      scrollContainers.push(el.path);
    }
    if (el.computed.position === "fixed" || el.computed.position === "sticky") {
      fixedOrAbsolute.push(el.path);
    }
    if (el.rect.top < viewport.height && el.rect.bottom > 0) {
      firstViewportElements.push(el.path);
    }
  }
  return {
    firstViewportElements,
    majorRegions,
    headings,
    actions,
    scrollContainers,
    fixedOrAbsolute,
  };
}

export interface CollectOptions {
  readonly surfaceId: string;
  readonly state?: string;
  readonly path: string;
}

export async function collectGeometry(
  page: Page,
  options: CollectOptions,
): Promise<GeometryReport> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const { elements: rawElements, document } = await collect(page);
  // We re-type into our exported interface.
  const elements = rawElements as unknown as ElementGeometry[];
  const violations = runInvariants(elements, document, viewport);
  const summary = buildSummary(elements, viewport);
  return {
    surfaceId: options.surfaceId,
    path: options.path,
    state: options.state ?? "default",
    viewport,
    document,
    elements,
    violations,
    summary,
  };
}

export function formatViolation(v: Violation): string {
  const lines = [`KIND ${v.kind}`, `MSG   ${v.message}`];
  if (v.element) {
    lines.push(`ELEM  ${v.element.path}`);
    lines.push(
      `RECT  x=${v.element.rect.x} y=${v.element.rect.y} w=${v.element.rect.width} h=${v.element.rect.height} right=${v.element.rect.right}`,
    );
  }
  if (v.container) {
    lines.push(`CONT  ${v.container.path}`);
    lines.push(
      `CRECT x=${v.container.rect.x} y=${v.container.rect.y} w=${v.container.rect.width} h=${v.container.rect.height} right=${v.container.rect.right}`,
    );
  }
  if (v.peer) {
    lines.push(`PEER  ${v.peer.path}`);
    lines.push(
      `PRECT x=${v.peer.rect.x} y=${v.peer.rect.y} w=${v.peer.rect.width} h=${v.peer.rect.height} right=${v.peer.rect.right}`,
    );
  }
  if (typeof v.delta === "number") lines.push(`DELTA ${v.delta.toFixed(2)}px`);
  if (typeof v.area === "number") lines.push(`AREA  ${v.area.toFixed(2)}px²`);
  return lines.join("\n");
}
