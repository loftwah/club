import React from "react";
import { colours, fonts, hairline } from "../theme";

export const BrandLockup: React.FC<{ compact?: boolean; inverse?: boolean }> = ({
  compact = false,
  inverse = false,
}) => {
  const ink = inverse ? colours.paper : colours.ink;
  return (
    <div
      style={{
        alignItems: "center",
        color: ink,
        display: "flex",
        fontFamily: fonts.display,
        fontSize: compact ? 20 : 28,
        fontWeight: 680,
        gap: compact ? 9 : 12,
        letterSpacing: "-0.045em",
        lineHeight: 1,
      }}
    >
      <span
        style={{
          border: `2px solid ${ink}`,
          display: "inline-flex",
          fontFamily: fonts.mono,
          fontSize: compact ? 9 : 12,
          height: compact ? 24 : 32,
          letterSpacing: "0.04em",
          alignItems: "center",
          justifyContent: "center",
          width: compact ? 24 : 32,
        }}
      >
        21
      </span>
      <span>Plans With You</span>
      <span
        style={{
          borderTop: hairline,
          height: 1,
          marginLeft: compact ? 3 : 6,
          opacity: 0.35,
          width: compact ? 26 : 52,
        }}
      />
    </div>
  );
};
