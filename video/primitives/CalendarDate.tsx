import React from "react";
import { colours, fonts, paperShadow } from "../theme";
import { clamped, pulse, settle } from "../lib/motion";

export type CalendarState = "planned" | "approaching" | "cancelled";

export const CalendarDate: React.FC<{
  frame: number;
  state: CalendarState;
  month: string;
  day: string;
  time: string;
  label: string;
  progress?: number;
  orientation?: "landscape" | "vertical";
}> = ({ frame, state, month, day, time, label, progress = 0, orientation = "landscape" }) => {
  const vertical = orientation === "vertical";
  const entered = settle(frame, 0, 20);
  const marked = state === "cancelled" ? clamped(frame, [0, 16], [0, 1]) : 0;
  const statusColour =
    state === "cancelled"
      ? colours.signal
      : state === "approaching"
        ? colours.cobaltDark
        : colours.ink;
  return (
    <div
      style={{
        backgroundColor: colours.paperLight,
        border: `1px solid ${colours.ink}`,
        boxShadow: paperShadow,
        opacity: entered,
        padding: vertical ? 22 : 28,
        position: "relative",
        scale: 0.92 + entered * 0.08,
        width: vertical ? "100%" : 380,
      }}
    >
      <div
        style={{
          alignItems: "center",
          borderBottom: `1px solid ${colours.ink}`,
          display: "flex",
          justifyContent: "space-between",
          paddingBottom: 12,
        }}
      >
        <span style={{ fontFamily: fonts.mono, fontSize: 14, letterSpacing: "0.12em" }}>
          {month}
        </span>
        <span
          style={{
            color: statusColour,
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: "0.1em",
          }}
        >
          {state.toUpperCase()}
        </span>
      </div>
      <div style={{ alignItems: "baseline", display: "flex", gap: 12, padding: "24px 0 12px" }}>
        <span style={{ fontFamily: fonts.serif, fontSize: vertical ? 112 : 100, lineHeight: 0.8 }}>
          {day}
        </span>
        <span style={{ fontFamily: fonts.display, fontSize: vertical ? 24 : 22, fontWeight: 680 }}>
          {time}
        </span>
      </div>
      <div
        style={{ color: colours.inkSoft, fontFamily: fonts.display, fontSize: 18, fontWeight: 600 }}
      >
        {label}
      </div>
      <div
        style={{ backgroundColor: colours.paperDeep, height: 8, marginTop: 25, overflow: "hidden" }}
      >
        <div
          style={{
            backgroundColor: state === "cancelled" ? colours.signal : colours.cobalt,
            height: "100%",
            scale: `${Math.max(0, Math.min(1, progress))} 1`,
            transformOrigin: "left center",
            width: "100%",
          }}
        />
      </div>
      {state === "cancelled" ? (
        <div
          style={{
            alignItems: "center",
            color: colours.signal,
            display: "flex",
            fontFamily: fonts.mono,
            fontSize: 11,
            justifyContent: "space-between",
            letterSpacing: "0.1em",
            marginTop: 16,
          }}
        >
          <span>CANCELLED</span>
          <span>FULFILLED</span>
        </div>
      ) : (
        <div
          style={{
            color: colours.inkFaint,
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: "0.1em",
            marginTop: 16,
          }}
        >
          {Math.round(progress * 100)}% /{" "}
          {state === "approaching" ? "DATE APPROACHING" : "ON THE LIST"}
        </div>
      )}
      {marked > 0 ? (
        <div
          style={{
            backgroundColor: colours.signal,
            height: 5,
            left: -18,
            opacity: marked,
            position: "absolute",
            rotate: "-12deg",
            top: "52%",
            width: "calc(100% + 36px)",
          }}
        />
      ) : null}
      {pulse(frame, 0, 12) > 0 ? (
        <div
          style={{
            backgroundColor: colours.signalBright,
            borderRadius: "50%",
            height: 7,
            opacity: pulse(frame, 0, 12),
            position: "absolute",
            right: 22,
            top: 22,
            width: 7,
          }}
        />
      ) : null}
    </div>
  );
};
