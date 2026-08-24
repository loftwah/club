import React from "react";
import { colours, fonts } from "../theme";
import { clamped } from "../lib/motion";
import type { CtaProps } from "../types";
import { BrandLockup } from "./BrandLockup";
import { CallToAction } from "./CallToAction";

export const EndCard: React.FC<{
  frame: number;
  title: string;
  body: string;
  cta: CtaProps;
  vertical?: boolean;
  inverse?: boolean;
}> = ({ frame, title, body, cta, vertical = false, inverse = false }) => {
  const opacity = clamped(frame, [0, 10], [0, 1]);
  const background = inverse ? colours.ink : colours.paper;
  const foreground = inverse ? colours.paper : colours.ink;
  return (
    <div
      style={{
        backgroundColor: background,
        boxSizing: "border-box",
        color: foreground,
        display: "flex",
        flexDirection: "column",
        gap: vertical ? 36 : 24,
        height: "100%",
        inset: 0,
        justifyContent: "space-between",
        minHeight: "100%",
        opacity,
        padding: vertical ? "192px 88px" : "84px 100px 72px",
        position: "absolute",
        width: "100%",
      }}
    >
      <BrandLockup inverse={inverse} />
      <div style={{ maxWidth: vertical ? "100%" : 980 }}>
        <div
          style={{
            fontFamily: fonts.serif,
            fontSize: vertical ? 66 : 82,
            letterSpacing: "-0.045em",
            lineHeight: 0.9,
            marginBottom: 26,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: inverse ? "rgb(245 242 234 / 78%)" : colours.inkSoft,
            fontFamily: fonts.serif,
            fontSize: vertical ? 25 : 28,
            lineHeight: 1.15,
            maxWidth: vertical ? "100%" : 700,
          }}
        >
          {body}
        </div>
      </div>
      <CallToAction cta={cta} dark={inverse} frame={Math.max(0, frame - 12)} vertical={vertical} />
      <div
        style={{
          borderTop: `1px solid ${inverse ? "rgb(245 242 234 / 45%)" : colours.ink}`,
          color: inverse ? "rgb(245 242 234 / 62%)" : colours.inkFaint,
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: "0.12em",
          paddingTop: 14,
        }}
      >
        PLANS WITH YOU / YOU ARE WANTED
      </div>
    </div>
  );
};
