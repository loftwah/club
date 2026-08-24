import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AudioTrack } from "../audio";
import type { PlanProps } from "../types";
import { fontFaces, frameStyle } from "../theme";
import { SafeZoneOverlay } from "../primitives/SafeZoneOverlay";
import { PlanArrivalScene } from "../scenes/PlanArrivalScene";
import { PlanApproachScene } from "../scenes/PlanApproachScene";
import { PlanCancellationScene } from "../scenes/PlanCancellationScene";
import { PlanDecidedScene } from "../scenes/PlanDecidedScene";
import { PlanReliefScene } from "../scenes/PlanReliefScene";

const CampaignATimeline: React.FC<PlanProps & { pacing: "landscape" | "vertical" }> = (props) => {
  const vertical = props.pacing === "vertical";
  const duration = vertical ? 480 : 600;
  const sceneProps = {
    ...props,
    orientation: vertical ? ("vertical" as const) : ("landscape" as const),
  };
  const timing = vertical
    ? ({
        arrival: [0, 82],
        decided: [74, 174],
        approach: [164, 280],
        cancellation: [270, 378],
        relief: [368, 480],
      } as const)
    : ({
        arrival: [0, 110],
        decided: [100, 224],
        approach: [214, 360],
        cancellation: [350, 490],
        relief: [480, 600],
      } as const);
  return (
    <AbsoluteFill style={frameStyle}>
      <style>{fontFaces}</style>
      <Sequence
        durationInFrames={timing.arrival[1] - timing.arrival[0]}
        name="Scene 01 / Invitation arrives"
      >
        <PlanArrivalScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.decided[0]}
        durationInFrames={timing.decided[1] - timing.decided[0]}
        name="Scene 02 / Plan becomes real"
      >
        <PlanDecidedScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.approach[0]}
        durationInFrames={timing.approach[1] - timing.approach[0]}
        name="Scene 03 / Date approaches"
      >
        <PlanApproachScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.cancellation[0]}
        durationInFrames={timing.cancellation[1] - timing.cancellation[0]}
        name="Scene 04 / Cancellation fulfils"
      >
        <PlanCancellationScene {...sceneProps} />
      </Sequence>
      <Sequence
        from={timing.relief[0]}
        durationInFrames={timing.relief[1] - timing.relief[0]}
        name="Scene 05 / Relief"
      >
        <PlanReliefScene {...sceneProps} />
      </Sequence>
      <Sequence durationInFrames={duration} name="Audio / designed hooks">
        <AudioTrack
          asset="video/audio/sonic-bed.mp3"
          fadeOutFrames={24}
          loop
          profile={sceneProps.audioProfile}
          volume={0.8}
        />
      </Sequence>
      <Sequence from={timing.arrival[0]} durationInFrames={66} name="Audio / paper arrival">
        <AudioTrack
          asset="video/audio/paper-arrival.mp3"
          profile={sceneProps.audioProfile}
          volume={0.75}
        />
      </Sequence>
      <Sequence from={timing.decided[0]} durationInFrames={48} name="Audio / calendar settle">
        <AudioTrack
          asset="video/audio/calendar-settle.mp3"
          profile={sceneProps.audioProfile}
          volume={0.7}
        />
      </Sequence>
      <Sequence from={timing.cancellation[0]} durationInFrames={72} name="Audio / cancellation">
        <AudioTrack
          asset="video/audio/cancellation.mp3"
          profile={sceneProps.audioProfile}
          volume={0.85}
        />
      </Sequence>
      <SafeZoneOverlay orientation={sceneProps.orientation} {...sceneProps.safeZones} />
    </AbsoluteFill>
  );
};

/** Landscape has room for a slower administrative read; vertical is a native, tighter social cut. */
export const CampaignA: React.FC<PlanProps> = (props) => (
  <CampaignATimeline {...props} pacing="landscape" />
);
export const CampaignAVertical: React.FC<PlanProps> = (props) => (
  <CampaignATimeline {...props} pacing="vertical" />
);
