// THROWAWAY: prototype React island that mounts the actual
// @designcodeio/threeui EngravedCertificate component. Used by
// src/pages/brand-explorer.astro. Will be deleted once the user
// locks a direction. The component is loaded only on the client.

import { useEffect, useRef, useState } from "react";

interface Props {
  mode: "light" | "dark";
}

export default function ThreeUISealPrototype({ mode }: Props) {
  const [status, setStatus] = useState<"loading" | "mounted" | "fallback" | "reduced-motion">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setStatus("reduced-motion");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@designcodeio/threeui");
        await import("@designcodeio/threeui/style.css");
        if (cancelled || !ref.current) return;
        const EngravedCertificate = mod.EngravedCertificate;
        if (typeof EngravedCertificate !== "function") {
          setError("EngravedCertificate export is not a function");
          setStatus("fallback");
          return;
        }
        // Render into a host element via a small React renderer.
        const { createElement } = await import("react");
        const { createRoot } = await import("react-dom/client");
        const root = createRoot(ref.current);
        root.render(
          createElement(EngravedCertificate, {
            mode,
            hue: 0,
            saturation: 0.6,
            brightness: 0.9,
            style: { width: "200px", height: "200px" },
          }),
        );
        if (!cancelled) setStatus("mounted");
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setStatus("fallback");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <div
      ref={ref}
      data-threeui-status={status}
      data-threeui-mode={mode}
      data-threeui-error={error ?? ""}
      className="bx-threeui-mount"
      aria-hidden="true"
    >
      {status === "loading" && <p className="bx-threeui-status">Mounting EngravedCertificate…</p>}
      {status === "fallback" && (
        <p className="bx-threeui-status bx-threeui-status--fallback">
          ThreeUI did not mount — using static fallback. {error ?? ""}
        </p>
      )}
      {status === "reduced-motion" && (
        <p className="bx-threeui-status">Skipped: prefers-reduced-motion.</p>
      )}
    </div>
  );
}
