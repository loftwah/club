import React from "react";
import { colours, fonts } from "../theme";

export const StatusBadge: React.FC<{
  children: React.ReactNode;
  tone?: "ink" | "signal" | "cobalt" | "success";
}> = ({ children, tone = "ink" }) => {
  const palette =
    tone === "signal"
      ? { backgroundColor: colours.signalSoft, color: colours.signal }
      : tone === "cobalt"
        ? { backgroundColor: "#DDE3FF", color: colours.cobaltDark }
        : tone === "success"
          ? { backgroundColor: "#D8EADC", color: colours.success }
          : { backgroundColor: colours.ink, color: colours.paper };
  return (
    <span
      style={{
        ...palette,
        display: "inline-block",
        fontFamily: fonts.mono,
        fontSize: 11,
        letterSpacing: "0.1em",
        padding: "8px 10px",
      }}
    >
      {children}
    </span>
  );
};
