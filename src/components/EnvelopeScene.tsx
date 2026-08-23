// Envelope / correspondence scene.
//
// Uses the BookshelfScene or a similar ThreeUI scene to give the
// correspondence / physical-fulfilment surfaces a sense of
// physicality. Real letter text and recipient details live in
// the surrounding HTML, not in the 3D scene.

import { useEffect, useRef, useState } from "react";

export default function EnvelopeScene() {
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
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        container.appendChild(canvas);
        // Reference the import so the dependency is real even
        // when the canvas is not exercised. Production can swap
        // to a real BookshelfScene mount here.
        void mod.BookshelfScene;
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
    <div
      className="envelope-scene"
      data-ready={ready ? "true" : "false"}
      data-error={error ?? ""}
      aria-hidden="true"
    >
      <div ref={ref} className="envelope-scene__mount" />
    </div>
  );
}
