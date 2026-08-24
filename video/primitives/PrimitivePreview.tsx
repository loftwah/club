import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CalendarDate } from "./CalendarDate";
import { CancellationMark } from "./CancellationMark";
import { Envelope } from "./Envelope";
import { MembershipCard } from "./MembershipCard";
import { SafeZoneOverlay } from "./SafeZoneOverlay";
import type { PreviewProps } from "../types";
import { colours, fontFaces, fonts, frameStyle } from "../theme";

export type PrimitiveName = "calendar" | "cancellation" | "envelope" | "membership";

export const PrimitivePreview: React.FC<PreviewProps & { primitive: PrimitiveName }> = ({
  orientation,
  primitive,
  safeZones,
}) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  return (
    <AbsoluteFill
      style={{
        ...frameStyle,
        alignItems: "center",
        justifyContent: "center",
        padding: vertical ? 72 : 100,
      }}
    >
      <style>{fontFaces}</style>
      {primitive === "calendar" ? (
        <CalendarDate
          frame={frame}
          state="approaching"
          month="OCT"
          day="21"
          time="7:30 PM"
          label="NEARBY / UNDISCLOSED"
          progress={0.74}
          orientation={orientation}
        />
      ) : null}
      {primitive === "cancellation" ? (
        <CancellationMark frame={frame} label="CANCELLED / SUCCESSFUL" />
      ) : null}
      {primitive === "envelope" ? (
        <div
          style={{
            height: vertical ? 350 : 240,
            position: "relative",
            width: vertical ? "100%" : 560,
          }}
        >
          <Envelope frame={frame} vertical={vertical} />
          <Envelope frame={frame} index={1} vertical={vertical} label="ANOTHER NOTE / PWY" />
          <Envelope frame={frame} index={2} vertical={vertical} label="CHAPTER / 01" />
        </div>
      ) : null}
      {primitive === "membership" ? (
        <MembershipCard frame={frame} memberNumber="SAMPLE-000" vertical={vertical} />
      ) : null}
      <div
        style={{
          bottom: 32,
          color: colours.inkFaint,
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          position: "absolute",
        }}
      >
        PRIMITIVE / {primitive.toUpperCase()}
      </div>
      <SafeZoneOverlay orientation={orientation} {...safeZones} />
    </AbsoluteFill>
  );
};
