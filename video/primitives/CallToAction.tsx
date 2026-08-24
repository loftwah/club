import React from "react";
import { colours, fonts } from "../theme";
import { clamped } from "../lib/motion";
import type { CtaProps } from "../types";

export const CallToAction: React.FC<{
  frame: number;
  cta: CtaProps;
  vertical?: boolean;
  dark?: boolean;
}> = ({ frame, cta, vertical = false, dark = false }) => {
  const opacity = clamped(frame, [0, 18], [0, 1]);
  const background = dark ? colours.paper : colours.ink;
  const foreground = dark ? colours.ink : colours.paper;
  return (
    <div
      style={{
        color: foreground,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity,
        translate: `0px ${18 * (1 - opacity)}px`,
        width: vertical ? "100%" : 480,
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
        <div
          style={{
            backgroundColor: background,
            boxSizing: "border-box",
            fontFamily: fonts.display,
            fontSize: 18,
            fontWeight: 680,
            padding: "16px 20px",
          }}
        >
          {cta.label}
        </div>
        <div
          style={{
            backgroundColor: dark ? colours.signal : colours.signalBright,
            height: 10,
            width: 10,
          }}
        />
      </div>
      <div
        style={{
          color: dark ? "rgb(245 242 234 / 72%)" : colours.inkSoft,
          fontFamily: fonts.serif,
          fontSize: vertical ? 21 : 20,
          lineHeight: 1.2,
        }}
      >
        {cta.note}
      </div>
    </div>
  );
};
