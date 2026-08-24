import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AudioTrack } from "../audio";
import type { RelationshipProps } from "../types";
import { fontFaces, frameStyle } from "../theme";
import { SafeZoneOverlay } from "../primitives/SafeZoneOverlay";
import { CorrespondenceArrivalScene } from "../scenes/CorrespondenceArrivalScene";
import { CorrespondenceGatherScene } from "../scenes/CorrespondenceGatherScene";
import { MembershipStabilityScene } from "../scenes/MembershipStabilityScene";
import { MilestoneScene } from "../scenes/MilestoneScene";
import { RelationshipCloseScene } from "../scenes/RelationshipCloseScene";

const CampaignBTimeline: React.FC<RelationshipProps & { pacing: "landscape" | "vertical" }> = (
  props,
) => {
  const vertical = props.pacing === "vertical";
  const duration = vertical ? 480 : 630;
  const sceneProps = {
    ...props,
    orientation: vertical ? ("vertical" as const) : ("landscape" as const),
  };
  const timing = vertical
    ? ({
        arrival: [0, 94],
        gather: [84, 204],
        stability: [194, 310],
        milestone: [300, 394],
        close: [384, 480],
      } as const)
    : ({
        arrival: [0, 122],
        gather: [112, 258],
        stability: [248, 398],
        milestone: [388, 526],
        close: [516, 630],
      } as const);
  return (
    <AbsoluteFill style={frameStyle}>
      <style>{fontFaces}</style>
      <Sequence
        durationInFrames={timing.arrival[1] - timing.arrival[0]}
        name="Scene 01 / Correspondence arrives"
      >
        <CorrespondenceArrivalScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.gather[0]}
        durationInFrames={timing.gather[1] - timing.gather[0]}
        name="Scene 02 / Correspondence gathers"
      >
        <CorrespondenceGatherScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.stability[0]}
        durationInFrames={timing.stability[1] - timing.stability[0]}
        name="Scene 03 / Membership is stable"
      >
        <MembershipStabilityScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.milestone[0]}
        durationInFrames={timing.milestone[1] - timing.milestone[0]}
        name="Scene 04 / Restrained milestone"
      >
        <MilestoneScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.close[0]}
        durationInFrames={timing.close[1] - timing.close[0]}
        name="Scene 05 / The relationship remains"
      >
        <RelationshipCloseScene {...sceneProps} />
      </Sequence>
      <Sequence durationInFrames={duration} name="Audio / designed hooks">
        <AudioTrack
          asset="video/audio/sonic-bed.mp3"
          fadeOutFrames={24}
          loop
          profile={sceneProps.audioProfile}
          volume={0.7}
        />
      </Sequence>
      <Sequence from={timing.arrival[0]} durationInFrames={66} name="Audio / paper arrival">
        <AudioTrack
          asset="video/audio/paper-arrival.mp3"
          profile={sceneProps.audioProfile}
          volume={0.75}
        />
      </Sequence>
      <Sequence from={timing.gather[0]} durationInFrames={96} name="Audio / correspondence">
        <AudioTrack
          asset="video/audio/correspondence.mp3"
          profile={sceneProps.audioProfile}
          volume={0.72}
        />
      </Sequence>
      <Sequence from={timing.milestone[0]} durationInFrames={60} name="Audio / milestone">
        <AudioTrack
          asset="video/audio/milestone.mp3"
          profile={sceneProps.audioProfile}
          volume={0.7}
        />
      </Sequence>
      <SafeZoneOverlay orientation={sceneProps.orientation} {...sceneProps.safeZones} />
    </AbsoluteFill>
  );
};

/** Landscape gives correspondence room to accumulate; vertical is a native, tighter social cut. */
export const CampaignB: React.FC<RelationshipProps> = (props) => (
  <CampaignBTimeline {...props} pacing="landscape" />
);
export const CampaignBVertical: React.FC<RelationshipProps> = (props) => (
  <CampaignBTimeline {...props} pacing="vertical" />
);
