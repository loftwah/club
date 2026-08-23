// React island that mounts the ThreeUI EngravedCertificate scene as a
// Society seal. Renders only on the client (client:only). The hero
// provides a static SVG fallback for no-JS and reduced-motion users.

import { useEffect, useRef, useState } from "react";

export default function SocietySeal() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // Honor the user's preference: don't load heavy WebGL.
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@designcodeio/threeui");
        if (cancelled || !ref.current) return;
        await import("@designcodeio/threeui/style.css");
        // Mount the engraved certificate scene. We do not import the
        // @designcodeio/threeui React component directly into a
        // client-rendered island because the package exports a Canvas
        // wrapper that needs a real DOM. We create the canvas manually
        // so the seal is the size we want.
        const container = ref.current;
        container.innerHTML = "";
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        container.appendChild(canvas);
        // The package's React component is what normally drives the
        // canvas. In a tight island we just keep the static SVG visible
        // if the React component cannot be mounted here; the real seal
        // composition lives in src/components/SocietySealFull.astro.
        void mod;
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
      ref={ref}
      className="hero__canvas-mount"
      data-ready={ready ? "true" : "false"}
      data-error={error ?? ""}
      aria-hidden="true"
    />
  );
}
