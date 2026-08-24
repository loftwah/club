import React from "react";
import { useCurrentFrame } from "remotion";
import type { PlanProps } from "../types";
import { colours, fonts } from "../theme";
import { CalendarDate } from "../primitives/CalendarDate";
import { StatusBadge } from "../primitives/StatusBadge";
import { SceneRail, SceneShell, SceneTitle } from "./shared";
import { clamped } from "../lib/motion";

export const PlanApproachScene: React.FC<PlanProps> = ({ orientation, copy, month, day, time }) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  const progress = clamped(frame, [0, 105], [0.38, 0.91]);
  return (
    <SceneShell vertical={vertical}>
      <SceneRail left={copy.eyebrow} right="03 / APPROACHING" />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: vertical ? "column" : "row",
          gap: vertical ? 44 : 100,
          justifyContent: "center",
          paddingTop: 60,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 25,
            justifyContent: "center",
            width: vertical ? "100%" : "47%",
          }}
        >
          <StatusBadge tone="cobalt">{copy.approachingLabel}</StatusBadge>
          <SceneTitle vertical={vertical}>
            The date
            <br />
            gets close.
          </SceneTitle>
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 23 : 26,
              lineHeight: 1.18,
              maxWidth: 570,
            }}
          >
            A plan can approach without becoming a demand. The quiet part is intentional.
          </div>
          <div
            style={{
              borderLeft: `4px solid ${colours.cobalt}`,
              color: colours.ink,
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: "0.08em",
              padding: "10px 0 10px 16px",
            }}
          >
            NO ATTENDANCE
            <br />
            REQUIRED
          </div>
        </div>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "center" }}>
          <CalendarDate
            frame={frame}
            state="approaching"
            month={month}
            day={day}
            time={time}
            label={copy.placeLabel}
            progress={progress}
            orientation={orientation}
          />
        </div>
      </div>
      <div
        style={{
          bottom: vertical ? 192 : 44,
          display: "flex",
          justifyContent: "space-between",
          left: vertical ? 88 : 100,
          position: "absolute",
          right: vertical ? 88 : 100,
        }}
      >
        <span
          style={{
            color: colours.inkFaint,
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: "0.1em",
          }}
        >
          MOMENTUM / CONTROLLED
        </span>
        <span
          style={{
            color: colours.cobaltDark,
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: "0.1em",
          }}
        >
          {Math.round(progress * 100)}%
        </span>
      </div>
    </SceneShell>
  );
};
