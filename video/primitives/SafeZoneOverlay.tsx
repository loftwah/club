import React from "react";
import { colours, fonts } from "../theme";
import { safeZoneProfileMetadata, type SafeZoneProps } from "../types";

export const SafeZoneOverlay: React.FC<
  SafeZoneProps & { orientation: "landscape" | "vertical" }
> = ({ showSafeZones, profile, topPercent, bottomPercent, sidePercent, orientation }) => {
  if (!showSafeZones) return null;
  const metadata = safeZoneProfileMetadata[profile];
  return (
    <div
      style={{
        border: `2px dashed ${colours.cobalt}`,
        boxSizing: "border-box",
        inset: `${topPercent}% ${sidePercent}% ${bottomPercent}%`,
        pointerEvents: "none",
        position: "absolute",
        zIndex: 100,
      }}
    >
      <div
        style={{
          backgroundColor: colours.cobalt,
          color: colours.paper,
          fontFamily: fonts.mono,
          fontSize: 10,
          left: 0,
          letterSpacing: "0.08em",
          lineHeight: 1.4,
          maxWidth: 440,
          padding: "5px 7px",
          position: "absolute",
          top: 0,
        }}
      >
        {orientation.toUpperCase()} / {profile} / VERIFIED {metadata.verifiedDate}
      </div>
      <div
        style={{
          border: `1px dashed ${colours.signal}`,
          inset: orientation === "vertical" ? "0 7%" : "7% 0",
          position: "absolute",
        }}
      />
      <div
        style={{
          bottom: 5,
          color: colours.signal,
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: "0.08em",
          position: "absolute",
          right: 0,
        }}
      >
        CONSERVATIVE ASSUMPTION / {metadata.sourceNotes}
      </div>
    </div>
  );
};
