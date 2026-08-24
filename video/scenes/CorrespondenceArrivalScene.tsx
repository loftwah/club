import React from "react";
import { useCurrentFrame } from "remotion";
import type { RelationshipProps } from "../types";
import { colours, fonts } from "../theme";
import { Envelope, Letter } from "../primitives/Envelope";
import { SceneRail, SceneShell, SceneTitle } from "./shared";

export const CorrespondenceArrivalScene: React.FC<RelationshipProps> = ({ orientation, copy }) => {
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
          gap: vertical ? 46 : 88,
          justifyContent: "center",
          paddingTop: 42,
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
          <SceneTitle vertical={vertical}>{copy.title}</SceneTitle>
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 24 : 27,
              lineHeight: 1.18,
              maxWidth: 560,
            }}
          >
            {copy.body}
          </div>
          <div
            style={{
              color: colours.inkFaint,
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
            }}
          >
            IN THE POST / A QUIET ARRIVAL
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flex: 1,
            justifyContent: "center",
            minHeight: vertical ? 320 : undefined,
            position: "relative",
          }}
        >
          <Envelope frame={frame} vertical={vertical} label={copy.letterLabel} />
          <Letter
            frame={Math.max(0, frame - 9)}
            vertical={vertical}
            label={copy.letterLabel}
            body={copy.letterBody}
          />
        </div>
      </div>
    </SceneShell>
  );
};
