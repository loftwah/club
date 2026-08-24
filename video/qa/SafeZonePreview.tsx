import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { PreviewProps } from "../types";
import { fontFaces, frameStyle } from "../theme";
import { SafeZoneOverlay } from "../primitives/SafeZoneOverlay";
import { SceneRail, SceneShell, SceneTitle } from "../scenes/shared";

export const SafeZonePreview: React.FC<PreviewProps> = ({ orientation, safeZones }) => {
  const frame = useCurrentFrame();
  return (
    <SceneShell vertical={orientation === "vertical"}>
      <style>{fontFaces}</style>
      <SceneRail left="QA / SAFE-ZONES" right={`${String(frame).padStart(3, "0")}F`} />
      <AbsoluteFill
        style={{
          ...frameStyle,
          backgroundColor: "transparent",
          padding: orientation === "vertical" ? "180px 48px" : "150px 100px",
        }}
      >
        <SceneTitle vertical={orientation === "vertical"}>
          Keep the promise
          <br />
          inside the frame.
        </SceneTitle>
        <div
          style={{
            fontFamily: "PWY Mono, monospace",
            fontSize: 14,
            letterSpacing: "0.1em",
            marginTop: 28,
          }}
        >
          SAFE-ZONE DEBUG / CONTROLLED BY PROPS
        </div>
      </AbsoluteFill>
      <SafeZoneOverlay orientation={orientation} {...safeZones} />
    </SceneShell>
  );
};
