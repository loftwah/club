import React from "react";
import { useCurrentFrame } from "remotion";
import type { RelationshipProps } from "../types";
import { colours, fonts } from "../theme";
import { Milestone } from "../primitives/Milestone";
import { SceneRail, SceneShell, SceneTitle } from "./shared";

export const MilestoneScene: React.FC<RelationshipProps> = ({ orientation, copy }) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  return (
    <SceneShell vertical={vertical}>
      <SceneRail left={copy.eyebrow} right="04 / MARK" />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: vertical ? "column" : "row",
          gap: vertical ? 42 : 90,
          justifyContent: "center",
          paddingTop: 52,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            justifyContent: "center",
            width: vertical ? "100%" : "47%",
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
            {copy.milestoneLabel}
          </div>
          <SceneTitle vertical={vertical}>
            A small mark
            <br />
            of time.
          </SceneTitle>
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 22 : 25,
              lineHeight: 1.2,
            }}
          >
            A birthday, a chapter, a note. When it is welcome, care can leave a small mark without
            becoming a test of attention.
          </div>
        </div>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "center" }}>
          <Milestone frame={frame} label="CHAPTER / 01" value="01" vertical={vertical} />
        </div>
      </div>
      <div
        style={{
          bottom: vertical ? 192 : 44,
          color: colours.inkFaint,
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          position: "absolute",
        }}
      >
        RESTRAINT / ATTENTION IS NEVER REQUIRED
      </div>
    </SceneShell>
  );
};
