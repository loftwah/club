import React from "react";
import { colours, fonts } from "../theme";
import { clamped } from "../lib/motion";

export const CancellationMark: React.FC<{ frame: number; label?: string; compact?: boolean }> = ({
  frame,
  label = "CANCELLED",
  compact = false,
}) => {
  const progress = clamped(frame, [0, 16], [0, 1]);
  return (
    <div
      style={{
        alignItems: "center",
        color: colours.signal,
        display: "flex",
        gap: compact ? 12 : 18,
        opacity: progress,
        rotate: `${-2 + progress * 2}deg`,
      }}
    >
      <div
        style={{
          backgroundColor: colours.signal,
          height: compact ? 3 : 6,
          width: compact ? 74 : 160,
        }}
      />
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: compact ? 12 : 18,
          fontWeight: 700,
          letterSpacing: "0.12em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          border: `${compact ? 2 : 3}px solid ${colours.signal}`,
          height: compact ? 22 : 34,
          rotate: "8deg",
          width: compact ? 22 : 34,
        }}
      />
    </div>
  );
};
