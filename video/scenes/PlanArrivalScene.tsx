import React from "react";
import { useCurrentFrame } from "remotion";
import type { PlanProps } from "../types";
import { colours, fonts } from "../theme";
import { PlanInvitation } from "../primitives/PlanInvitation";
import { SceneRail, SceneShell, SceneTitle } from "./shared";

export const PlanArrivalScene: React.FC<PlanProps> = ({ orientation, copy, memberNumber }) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  return (
    <SceneShell vertical={vertical}>
      <SceneRail left={copy.eyebrow} right="01 / ARRIVAL" />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: vertical ? "column" : "row",
          gap: vertical ? 44 : 70,
          justifyContent: "center",
          paddingTop: vertical ? 38 : 50,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            justifyContent: "center",
            width: vertical ? "100%" : "45%",
          }}
        >
          <SceneTitle vertical={vertical}>
            {copy.title}
            <br />
            {copy.subtitle}
          </SceneTitle>
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 24 : 26,
              lineHeight: 1.2,
              maxWidth: 540,
            }}
          >
            {copy.body}
          </div>
        </div>
        <div
          style={{
            alignItems: vertical ? "stretch" : "center",
            display: "flex",
            flex: vertical ? "unset" : 1,
            justifyContent: "center",
          }}
        >
          <PlanInvitation
            frame={frame}
            orientation={orientation}
            eyebrow={copy.eyebrow}
            planLabel={copy.planLabel}
            dateLabel={copy.dateLabel}
            timeLabel={copy.timeLabel}
            placeLabel={copy.placeLabel}
            memberNumber={memberNumber}
          />
        </div>
      </div>
      <div
        style={{
          bottom: vertical ? 192 : 36,
          color: colours.inkFaint,
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          position: "absolute",
        }}
      >
        A PLACE IS MADE / NOTHING IS REQUIRED
      </div>
    </SceneShell>
  );
};
