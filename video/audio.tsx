import React from "react";
import { Audio } from "@remotion/media";
import { interpolate, staticFile, useVideoConfig } from "remotion";
import type { AudioProfile } from "./types";

export type AudioAsset =
  | "video/audio/paper-arrival.mp3"
  | "video/audio/calendar-settle.mp3"
  | "video/audio/cancellation.mp3"
  | "video/audio/correspondence.mp3"
  | "video/audio/milestone.mp3"
  | "video/audio/sonic-bed.mp3";

/**
 * Audio is an enhancement: Remotion's onError handler keeps an absent asset
 * from cancelling a silent render while the generated campaign assets are
 * still being prepared.
 */
export const AudioTrack: React.FC<{
  profile: AudioProfile;
  asset: AudioAsset;
  volume?: number;
  loop?: boolean;
  fadeOutFrames?: number;
}> = ({ profile, asset, volume = 0.18, loop = false, fadeOutFrames = 0 }) => {
  const { durationInFrames } = useVideoConfig();
  if (profile === "silent") return null;
  const volumeAtFrame = (frame: number) => {
    const gain =
      fadeOutFrames > 0
        ? interpolate(frame, [durationInFrames - fadeOutFrames, durationInFrames - 1], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        : 1;
    return volume * gain;
  };
  return (
    <Audio loop={loop} onError={() => undefined} src={staticFile(asset)} volume={volumeAtFrame} />
  );
};
