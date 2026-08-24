import React from "react";
import { useCurrentFrame } from "remotion";
import type { PlanProps } from "../types";
import { colours, fonts } from "../theme";
import { CalendarDate } from "../primitives/CalendarDate";
import { CancellationMark } from "../primitives/CancellationMark";
import { StatusBadge } from "../primitives/StatusBadge";
import { SceneRail, SceneRule, SceneShell, SceneTitle } from "./shared";

export const PlanCancellationScene: React.FC<PlanProps> = ({
  orientation,
  copy,
  month,
  day,
  time,
}) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  return (
    <SceneShell vertical={vertical}>
      <SceneRail left={copy.eyebrow} right="04 / FULFILMENT" />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: vertical ? "column" : "row",
          gap: vertical ? 40 : 100,
          justifyContent: "center",
          paddingTop: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            justifyContent: "center",
            width: vertical ? "100%" : "46%",
          }}
        >
          <StatusBadge tone="signal">{copy.cancellationLabel}</StatusBadge>
          <SceneTitle vertical={vertical}>
            The plan
            <br />
            is unmade.
          </SceneTitle>
          <SceneRule />
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 22 : 24,
              lineHeight: 1.2,
            }}
          >
            Cancellation is not a failed event. It is the arrangement doing what it promised.
          </div>
          <CancellationMark frame={frame} label="CANCELLED / SUCCESSFUL" />
        </div>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "center" }}>
          <CalendarDate
            frame={frame}
            state="cancelled"
            month={month}
            day={day}
            time={time}
            label={copy.placeLabel}
            progress={1}
            orientation={orientation}
          />
        </div>
      </div>
      <div
        style={{
          bottom: vertical ? 192 : 44,
          color: colours.signal,
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          position: "absolute",
        }}
      >
        THE DATE HAS PASSED / THE RELATIONSHIP REMAINS
      </div>
    </SceneShell>
  );
};
