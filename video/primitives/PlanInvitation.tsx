import React from "react";
import { colours, fonts, paperShadow } from "../theme";
import { drift, settle } from "../lib/motion";
import { BrandLockup } from "./BrandLockup";

export type InvitationState = "arrival" | "placed" | "quiet";

export const PlanInvitation: React.FC<{
  frame: number;
  orientation: "landscape" | "vertical";
  eyebrow: string;
  planLabel: string;
  dateLabel: string;
  timeLabel: string;
  placeLabel: string;
  memberNumber: string;
  state?: InvitationState;
}> = ({
  frame,
  orientation,
  eyebrow,
  planLabel,
  dateLabel,
  timeLabel,
  placeLabel,
  memberNumber,
  state = "arrival",
}) => {
  const vertical = orientation === "vertical";
  const landing = settle(frame, 0, 22);
  const opacity = state === "quiet" ? 0.84 : Math.min(1, landing + 0.32);
  return (
    <div
      style={{
        backgroundColor: colours.paperLight,
        border: `1px solid ${colours.ink}`,
        boxShadow: paperShadow,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: vertical ? 30 : 22,
        justifyContent: "space-between",
        opacity,
        padding: vertical ? "38px 34px" : "36px 40px",
        position: "relative",
        translate: `0px ${drift(frame, 0, vertical ? 72 : 46, 22)}px`,
        width: vertical ? "100%" : 700,
        minHeight: vertical ? 430 : 360,
      }}
    >
      <BrandLockup compact />
      <div
        style={{
          color: colours.inkFaint,
          fontFamily: fonts.mono,
          fontSize: 12,
          letterSpacing: "0.12em",
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          borderTop: `1px solid ${colours.ink}`,
          display: "grid",
          gap: 16,
          gridTemplateColumns: vertical ? "1fr" : "1.2fr 0.8fr",
          paddingTop: 20,
        }}
      >
        <div>
          <div
            style={{
              color: colours.inkFaint,
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: "0.12em",
              marginBottom: 10,
            }}
          >
            {planLabel.toUpperCase()}
          </div>
          <div style={{ fontFamily: fonts.serif, fontSize: vertical ? 46 : 42, lineHeight: 0.98 }}>
            {dateLabel}
          </div>
          <div style={{ fontFamily: fonts.display, fontSize: 25, fontWeight: 680, marginTop: 12 }}>
            {placeLabel}
          </div>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}
        >
          <span
            style={{
              backgroundColor: colours.signalSoft,
              color: colours.signal,
              display: "inline-block",
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: "0.1em",
              padding: "8px 10px",
              width: "fit-content",
            }}
          >
            {timeLabel}
          </span>
          <span
            style={{
              color: colours.inkFaint,
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: "0.08em",
            }}
          >
            NO ATTENDANCE REQUIRED
          </span>
        </div>
      </div>
      <div
        style={{
          alignItems: "end",
          borderTop: `1px dashed ${colours.ink}`,
          display: "flex",
          fontFamily: fonts.mono,
          fontSize: 10,
          justifyContent: "space-between",
          letterSpacing: "0.1em",
          paddingTop: 14,
        }}
      >
        <span>INVITATION / HELD LIGHTLY</span>
        <span>SAMPLE / {memberNumber}</span>
      </div>
    </div>
  );
};
