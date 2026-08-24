import React from "react";
import { colours, fonts, paperShadow } from "../theme";
import { drift, settle } from "../lib/motion";

export const Envelope: React.FC<{
  frame: number;
  index?: number;
  vertical?: boolean;
  label?: string;
}> = ({ frame, index = 0, vertical = false, label = "A NOTE FOR YOU" }) => {
  const offset = index * (vertical ? 34 : 30);
  const entered = settle(frame, 2 + index * 3, 22);
  const angle = [-3, 1.5, -1, 2.8, -2.2][index % 5];
  const crossOffset = [0, 14, -10, 22, -6][index % 5];
  return (
    <div
      style={{
        backgroundColor: index % 2 === 0 ? colours.paperLight : colours.signalSoft,
        border: `1px solid ${colours.ink}`,
        boxShadow: paperShadow,
        boxSizing: "border-box",
        height: vertical ? 218 : 180,
        opacity: entered,
        padding: vertical ? 25 : 22,
        position: "absolute",
        scale: `${1 - index * 0.012}`,
        translate: `${vertical ? crossOffset : offset}px ${vertical ? offset : drift(frame, 0, 42, 24)}px`,
        rotate: `${angle}deg`,
        width: vertical ? "100%" : 286,
        zIndex: 10 - index,
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${colours.ink}`,
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: "0.1em",
          paddingBottom: 12,
        }}
      >
        {label}
      </div>
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        style={{ height: "54%", left: 0, position: "absolute", top: "29%", width: "100%" }}
        viewBox="0 0 100 100"
      >
        <polyline
          fill="none"
          points="0,0 50,58 100,0"
          stroke={colours.ink}
          strokeWidth="0.45"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        style={{
          bottom: 20,
          color: colours.inkFaint,
          fontFamily: fonts.serif,
          fontSize: 22,
          position: "absolute",
          right: 22,
        }}
      >
        Plans With You
      </div>
    </div>
  );
};

export const Letter: React.FC<{
  frame: number;
  vertical?: boolean;
  label: string;
  body: string;
}> = ({ frame, vertical = false, label, body }) => {
  const entered = settle(frame, 0, 30);
  return (
    <div
      style={{
        backgroundColor: colours.paperLight,
        border: `1px solid ${colours.ink}`,
        boxShadow: paperShadow,
        boxSizing: "border-box",
        opacity: entered,
        padding: vertical ? "34px 28px" : "34px 40px",
        rotate: `${-2 + entered * 2}deg`,
        translate: `0px ${drift(frame, 0, 55)}px`,
        width: vertical ? "100%" : 500,
      }}
    >
      <div
        style={{
          color: colours.inkFaint,
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          marginBottom: 24,
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: fonts.serif,
          fontSize: vertical ? 28 : 30,
          lineHeight: 1.12,
          margin: 0,
        }}
      >
        {body}
      </p>
      <div
        style={{
          borderTop: `1px dashed ${colours.ink}`,
          color: colours.inkFaint,
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: "0.1em",
          marginTop: 28,
          paddingTop: 12,
        }}
      >
        A PRIVATE CORRESPONDENCE / PWY
      </div>
    </div>
  );
};
