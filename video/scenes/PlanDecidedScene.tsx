import React from "react";
import { useCurrentFrame } from "remotion";
import type { PlanProps } from "../types";
import { colours, fonts } from "../theme";
import { CalendarDate } from "../primitives/CalendarDate";
import { PlanInvitation } from "../primitives/PlanInvitation";
import { StatusBadge } from "../primitives/StatusBadge";
import { SceneRail, SceneRule, SceneShell, SceneTitle } from "./shared";

export const PlanDecidedScene: React.FC<PlanProps> = ({
  orientation,
  copy,
  memberNumber,
  month,
  day,
  time,
}) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  return (
    <SceneShell vertical={vertical}>
      <SceneRail left={copy.eyebrow} right="02 / DECISIVE" />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: vertical ? "column" : "row",
          gap: vertical ? 34 : 80,
          justifyContent: "center",
          paddingTop: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            justifyContent: "center",
            width: vertical ? "100%" : "43%",
          }}
        >
          <StatusBadge tone="cobalt">PLAN / REAL</StatusBadge>
          <SceneTitle vertical={vertical}>
            A date becomes
            <br />
            plausible.
          </SceneTitle>
          <SceneRule />
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 22 : 24,
              lineHeight: 1.22,
              maxWidth: 560,
            }}
          >
            {copy.body} The details can be precise while the invitation stays light.
          </div>
          <div
            style={{
              color: colours.inkFaint,
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
            }}
          >
            LEAD TIME / 14 DAYS &nbsp;&nbsp; STATUS / HELD
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            justifyContent: "center",
          }}
        >
          <CalendarDate
            frame={frame}
            state="planned"
            month={month}
            day={day}
            time={time}
            label={copy.placeLabel}
            progress={0.34}
            orientation={orientation}
          />
          <PlanInvitation
            frame={Math.max(0, frame - 4)}
            orientation={orientation}
            eyebrow={copy.eyebrow}
            planLabel={copy.planLabel}
            dateLabel={copy.dateLabel}
            timeLabel={copy.timeLabel}
            placeLabel={copy.placeLabel}
            memberNumber={memberNumber}
            state="quiet"
          />
        </div>
      </div>
    </SceneShell>
  );
};
