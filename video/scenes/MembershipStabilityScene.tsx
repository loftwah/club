import React from "react";
import { useCurrentFrame } from "remotion";
import type { RelationshipProps } from "../types";
import { colours, fonts } from "../theme";
import { MembershipCard } from "../primitives/MembershipCard";
import { StatusBadge } from "../primitives/StatusBadge";
import { SceneRail, SceneRule, SceneShell, SceneTitle } from "./shared";

export const MembershipStabilityScene: React.FC<RelationshipProps> = ({
  orientation,
  copy,
  memberNumber,
}) => {
  const frame = useCurrentFrame();
  const vertical = orientation === "vertical";
  return (
    <SceneShell vertical={vertical}>
      <SceneRail left={copy.eyebrow} right="03 / STABILITY" />
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
            gap: 23,
            justifyContent: "center",
            width: vertical ? "100%" : "48%",
          }}
        >
          <StatusBadge tone="success">{copy.memberLabel}</StatusBadge>
          <SceneTitle vertical={vertical}>
            Silence is
            <br />
            still belonging.
          </SceneTitle>
          <SceneRule />
          <div
            style={{
              color: colours.inkSoft,
              fontFamily: fonts.serif,
              fontSize: vertical ? 22 : 25,
              lineHeight: 1.2,
              maxWidth: 560,
            }}
          >
            Membership does not ask you to prove you are using it. The place remains yours.
          </div>
          <div
            style={{
              color: colours.inkFaint,
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
            }}
          >
            DEMONSTRATION ID / {memberNumber}
          </div>
        </div>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "center" }}>
          <MembershipCard frame={frame} memberNumber={memberNumber} vertical={vertical} />
        </div>
      </div>
    </SceneShell>
  );
};
