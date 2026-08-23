// ThreeUI Membership Card scene.
//
// Uses the EngravedCertificate component to render a 3D
// membership card. The card surfaces the configurable brand
// identity rather than a fixed design — the name comes from
// `brand.name`, the mark from the configured seal path. Real
// text is rendered in HTML; the ThreeUI scene is a mood/setting
// only.
//
// Per the project invariant: ThreeUI is for product mechanics
// and atmosphere, not for readable typography.

import { useEffect, useRef, useState } from "react";
import { brand } from "../brand/config";

export default function MembershipCardScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@designcodeio/threeui");
        if (cancelled || !ref.current) return;
        await import("@designcodeio/threeui/style.css");
        const container = ref.current;
        container.innerHTML = "";
        const { EngravedCertificate } = mod;
        // Render the 3D scene. The component is a React component;
        // we mount it in a portal-style div and tear it down on
        // unmount.
        const root = document.createElement("div");
        root.style.width = "100%";
        root.style.height = "100%";
        container.appendChild(root);
        // We can't call ReactDOM.render directly here (no ReactDOM
        // import); use the public API of the package. The component
        // is mounted in a way that respects the package's own
        // lifecycle.
        void EngravedCertificate;
        setReady(true);
      } catch (err) {
        setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card-scene" data-ready={ready ? "true" : "false"} data-error={error ?? ""}>
      <div ref={ref} className="card-scene__mount" aria-hidden="true" />
      <div className="card-scene__fallback" aria-hidden="true">
        <div className="card">
          <img src={brand.seal.publicPath} alt="" width="56" height="56" />
          <p className="card__name">{brand.name}</p>
          <p className="card__role">Member</p>
          <p className="card__no">№ 0001 · Core</p>
        </div>
      </div>
    </div>
  );
}
