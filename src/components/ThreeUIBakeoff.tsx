import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";

type SceneKey = "certificate" | "fabric" | "data";
type SceneComponent = ComponentType<Record<string, unknown>>;

const sceneImports: Record<SceneKey, () => Promise<SceneComponent>> = {
  certificate: async () => {
    const module = await import("@designcodeio/threeui/components/EngravedCertificate");
    return module.EngravedCertificate as SceneComponent;
  },
  fabric: async () => {
    const module = await import("@designcodeio/threeui/components/WovenCloth");
    return module.WovenCloth as SceneComponent;
  },
  data: async () => {
    const module = await import("@designcodeio/threeui/components/StructureFlowCollection");
    return module.StructureFlowCollection as SceneComponent;
  },
};

const sceneProps: Record<SceneKey, Record<string, unknown>> = {
  certificate: {
    mode: "light",
    hue: 12,
    saturation: 0.38,
    brightness: 1.08,
    style: { width: "100%", height: "100%" } satisfies CSSProperties,
  },
  fabric: {
    mode: "dark",
    hue: 8,
    saturation: 0.7,
    brightness: 1.05,
  },
  data: {
    variant: "data-field",
    mode: "light",
    hue: 12,
    saturation: 0.26,
    brightness: 1.08,
  },
};

interface LazySceneProps {
  scene: SceneKey;
  label: string;
  fallback: ReactNode;
}

/**
 * Internal-only ThreeUI harness. The package owns its renderers and disposal;
 * this boundary owns admission: near-viewport loading, reduced-motion/static
 * fallback, and unmounting scenes when they leave the viewport.
 */
function LazyScene({ scene, label, fallback }: LazySceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [component, setComponent] = useState<SceneComponent | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    syncMotion();
    media.addEventListener?.("change", syncMotion);

    const observer = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.08)),
      { threshold: [0, 0.08] },
    );
    observer.observe(host);

    return () => {
      media.removeEventListener?.("change", syncMotion);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!active || reducedMotion || component || status === "error") return;
    let cancelled = false;
    setStatus("loading");

    void Promise.all([sceneImports[scene](), import("@designcodeio/threeui/style.css")])
      .then(([loaded]) => {
        if (cancelled) return;
        setComponent(() => loaded);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [active, component, reducedMotion, scene, status]);

  const showScene = active && !reducedMotion && component;
  const Scene = component;
  return (
    <div
      ref={hostRef}
      className="threeui-bakeoff__scene"
      data-threeui-scene={scene}
      data-threeui-status={reducedMotion ? "reduced-motion" : status}
      data-threeui-active={active ? "true" : "false"}
      data-pixel-ratio-cap="2"
      aria-hidden="true"
    >
      {showScene && Scene ? (
        <Scene aria-label={label} {...sceneProps[scene]} />
      ) : (
        <div className="threeui-bakeoff__fallback">
          {fallback}
          <span className="threeui-bakeoff__fallback-note">
            {reducedMotion
              ? "Static fallback · reduced motion"
              : status === "error"
                ? "Static fallback · WebGL unavailable"
                : active
                  ? "Mounting scene…"
                  : "Static fallback · scene idle outside viewport"}
          </span>
        </div>
      )}
    </div>
  );
}

function CalendarMark() {
  return (
    <span className="threeui-bakeoff__calendar-mark" aria-hidden="true">
      <span>PWY</span>
      <strong>24</strong>
    </span>
  );
}

function MembershipCardFallback() {
  return (
    <div className="threeui-bakeoff__card" aria-label="Static membership card fallback">
      <div className="threeui-bakeoff__card-top">
        <CalendarMark />
        <span>MEMBERSHIP CARD / SPECIMEN</span>
      </div>
      <div className="threeui-bakeoff__card-body">
        <strong>Plans With You</strong>
        <span>Member</span>
      </div>
      <div className="threeui-bakeoff__card-bottom">
        <span>№ 0001</span>
        <span>YOU ARE WANTED</span>
      </div>
    </div>
  );
}

function PlanStackFallback() {
  return (
    <div className="threeui-bakeoff__stack" aria-label="Static cancellation plan stack fallback">
      <div className="threeui-bakeoff__stack-back" />
      <div className="threeui-bakeoff__stack-middle" />
      <div className="threeui-bakeoff__plan-sheet">
        <span className="threeui-bakeoff__micro">PLAN / 024 / TERMINAL</span>
        <strong>Future date</strong>
        <div className="threeui-bakeoff__plan-rule" />
        <span className="threeui-bakeoff__cancelled">CANCELLED · SUCCESSFUL FULFILMENT</span>
      </div>
    </div>
  );
}

function EnvelopeFallback() {
  return (
    <div className="threeui-bakeoff__envelope" aria-label="Static correspondence envelope fallback">
      <div className="threeui-bakeoff__letter">
        <span>PLANS WITH YOU</span>
        <strong>Dear member,</strong>
        <p>The plan has been unmade. There is nothing you need to do.</p>
      </div>
      <div className="threeui-bakeoff__envelope-flap" />
      <span className="threeui-bakeoff__envelope-label">CORRESPONDENCE / 0001</span>
    </div>
  );
}

function Candidate({
  index,
  name,
  eyebrow,
  description,
  htmlLabel,
  threeLabel,
  scene,
  fallback,
  verdict,
}: {
  index: string;
  name: string;
  eyebrow: string;
  description: string;
  htmlLabel: string;
  threeLabel: string;
  scene: SceneKey;
  fallback: ReactNode;
  verdict: string;
}) {
  return (
    <article className="threeui-bakeoff__candidate">
      <header className="threeui-bakeoff__candidate-head">
        <span className="threeui-bakeoff__index">{index}</span>
        <div>
          <p className="threeui-bakeoff__eyebrow">{eyebrow}</p>
          <h3>{name}</h3>
          <p>{description}</p>
        </div>
        <p className="threeui-bakeoff__verdict">{verdict}</p>
      </header>
      <div className="threeui-bakeoff__comparison">
        <figure className="threeui-bakeoff__column">
          <figcaption>
            <span>HTML / CSS / Motion</span>
            <strong>{htmlLabel}</strong>
          </figcaption>
          <div className="threeui-bakeoff__visual threeui-bakeoff__visual--html">{fallback}</div>
          <p className="threeui-bakeoff__note">
            Semantic content, no client JavaScript, print-safe and fully available with reduced
            motion.
          </p>
        </figure>
        <figure className="threeui-bakeoff__column threeui-bakeoff__column--three">
          <figcaption>
            <span>ThreeUI / Three</span>
            <strong>{threeLabel}</strong>
          </figcaption>
          <LazyScene scene={scene} label={threeLabel} fallback={fallback} />
          <p className="threeui-bakeoff__note">
            Dynamic import on intersection · package DPR cap ≤2 · unmount pauses and lets the
            package dispose.
          </p>
        </figure>
      </div>
    </article>
  );
}

export default function ThreeUIBakeoff() {
  return (
    <div className="threeui-bakeoff">
      <div className="threeui-bakeoff__intro">
        <p className="threeui-bakeoff__eyebrow">Internal / ThreeUI production-candidate bakeoff</p>
        <h2>
          Keep the plan legible.
          <br />
          Let the material move.
        </h2>
        <p>
          A bounded comparison against the current Dispatch Wall primitives. The left column is the
          production baseline; the right column tests whether the official{" "}
          <code>@designcodeio/threeui</code>
          package earns a place as an optional visual layer. Real product copy stays in HTML.
        </p>
        <div className="threeui-bakeoff__rules" aria-label="Bakeoff rules">
          <span>NO PUBLIC ROUTE IMPORT</span>
          <span>STATIC / REDUCED MOTION FIRST</span>
          <span>WEBGL DISPOSES ON EXIT</span>
        </div>
      </div>

      <div className="threeui-bakeoff__candidates">
        <Candidate
          index="01"
          eyebrow="Membership card / invitation"
          name="A member is a record, not a badge."
          description="EngravedCertificate adds physical lathe texture to a restrained card while the member number, tier and wording remain real DOM text."
          htmlLabel="Dispatch card"
          threeLabel="Engraved certificate"
          scene="certificate"
          fallback={<MembershipCardFallback />}
          verdict="Candidate: useful only as a quiet reveal"
        />
        <Candidate
          index="02"
          eyebrow="Envelope / correspondence"
          name="Warmth belongs in the post."
          description="The CSS envelope makes the letter readable; WovenCloth tests whether a handled textile material can add depth without turning the digital product into heritage theatre."
          htmlLabel="Letter and envelope"
          threeLabel="Correspondence material"
          scene="fabric"
          fallback={<EnvelopeFallback />}
          verdict="Candidate: strongest material match"
        />
        <Candidate
          index="03"
          eyebrow="Cancellation counter / plan stack"
          name="Cancellation is a successful terminal state."
          description="A plan stack and counter must communicate state first. DataField is tested as a quiet system texture behind the explicit cancellation record."
          htmlLabel="Plan stack / counter"
          threeLabel="Data field texture"
          scene="data"
          fallback={<PlanStackFallback />}
          verdict="Candidate: reject for production clarity"
        />
      </div>

      <footer className="threeui-bakeoff__footer">
        <span className="threeui-bakeoff__eyebrow">Working judgement</span>
        <p>
          CSS wins the public contract. ThreeUI earns further investigation only for correspondence
          material, behind explicit internal gating and an asset/performance budget.
        </p>
      </footer>
    </div>
  );
}
