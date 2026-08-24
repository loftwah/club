import React from "react";
import { colours, fonts, paperShadow } from "../theme";
import { settle } from "../lib/motion";

export const MembershipCard: React.FC<{
  frame: number;
  memberNumber: string;
  vertical?: boolean;
  label?: string;
}> = ({ frame, memberNumber, vertical = false, label = "DEMONSTRATION" }) => {
  const entered = settle(frame, 0, 28);
  return (
    <div
      style={{
        backgroundColor: colours.ink,
        boxShadow: paperShadow,
        boxSizing: "border-box",
        color: colours.paper,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: vertical ? 250 : 210,
        opacity: entered,
        padding: vertical ? 28 : 30,
        rotate: `${-3 + entered * 3}deg`,
        scale: 0.94 + entered * 0.06,
        width: vertical ? "100%" : 450,
      }}
    >
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: "0.12em" }}>
          {label}
        </span>
        <span style={{ backgroundColor: colours.signal, height: 18, width: 18 }} />
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: vertical ? 42 : 38,
          fontWeight: 680,
          letterSpacing: "-0.04em",
        }}
      >
        Plans With You
      </div>
      <div
        style={{
          borderTop: "1px solid rgb(245 242 234 / 65%)",
          display: "flex",
          fontFamily: fonts.mono,
          fontSize: 11,
          justifyContent: "space-between",
          letterSpacing: "0.1em",
          paddingTop: 12,
        }}
      >
        <span>SAMPLE / {memberNumber}</span>
        <span>ACTIVE / QUIET</span>
      </div>
    </div>
  );
};
