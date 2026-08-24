import React from "react";
import { colours, fonts } from "../theme";
import { clamped, settle } from "../lib/motion";

export const Milestone: React.FC<{
  frame: number;
  label: string;
  value?: string;
  vertical?: boolean;
}> = ({ frame, label, value = "01", vertical = false }) => {
  const entered = settle(frame, 0, 26);
  const line = clamped(frame, [0, 24], [0, 1]);
  return (
    <div
      style={{
        opacity: entered,
        translate: `0px ${24 * (1 - entered)}px`,
        width: vertical ? "100%" : 420,
      }}
    >
      <div style={{ alignItems: "baseline", display: "flex", gap: 16 }}>
        <span style={{ fontFamily: fonts.serif, fontSize: vertical ? 92 : 84, lineHeight: 0.8 }}>
          {value}
        </span>
        <span style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: "0.1em" }}>
          {label}
        </span>
      </div>
      <div
        style={{
          backgroundColor: colours.ink,
          height: 1,
          marginTop: 24,
          scale: `${line} 1`,
          transformOrigin: "left center",
          width: "100%",
        }}
      />
      <div
        style={{
          color: colours.inkFaint,
          fontFamily: fonts.serif,
          fontSize: vertical ? 22 : 24,
          marginTop: 13,
        }}
      >
        A small mark, held in time.
      </div>
    </div>
  );
};
