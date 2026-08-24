import React from "react";
import { useCurrentFrame } from "remotion";
import type { RelationshipProps } from "../types";
import { colours, fonts } from "../theme";
import { Envelope } from "../primitives/Envelope";
import { SceneRail, SceneShell, SceneTitle } from "./shared";

export const CorrespondenceGatherScene: React.FC<RelationshipProps> = ({
  orientation,
  copy,
  correspondenceCount,
}) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  const items = Array.from({ length: correspondenceCount }, (_, index) => index);
  return (
    <SceneShell vertical={vertical}>
      <SceneRail left={copy.eyebrow} right="02 / GATHER" />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: vertical ? "column" : "row",
          gap: vertical ? 42 : 76,
          justifyContent: "center",
          paddingTop: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            justifyContent: "center",
            width: vertical ? "100%" : "42%",
          }}
        >
          <div
            style={{
              color: colours.signal,
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: "0.1em",
            }}
          >
            CORRESPONDENCE / {String(correspondenceCount).padStart(2, "0")}
          </div>
          <SceneTitle vertical={vertical}>
            The notes
            <br />
            gather.
          </SceneTitle>
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 23 : 26,
              lineHeight: 1.2,
            }}
          >
            Each note adds weight without adding obligation. The relationship accumulates quietly.
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flex: 1,
            justifyContent: "center",
            minHeight: vertical ? 365 : undefined,
            position: "relative",
          }}
        >
          {items.map((index) => (
            <Envelope
              frame={frame}
              index={index}
              key={index}
              vertical={vertical}
              label={
                index === 0
                  ? copy.letterLabel
                  : `NOTE / ${String(index + 1).padStart(2, "0")} / PWY`
              }
            />
          ))}
        </div>
      </div>
    </SceneShell>
  );
};
