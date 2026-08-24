import { Easing, interpolate, spring } from "remotion";

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export function clamped(frame: number, input: number[], output: number[]): number {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });
}

export function reveal(frame: number, start: number, duration = 18): number {
  return clamped(frame, [start, start + duration], [0, 1]);
}

export function settle(frame: number, start: number, duration = 24): number {
  return spring({
    frame: Math.max(0, frame - start),
    fps: 30,
    config: { damping: 200, mass: 0.75, stiffness: 120 },
    durationInFrames: duration,
  });
}

export function drift(frame: number, start: number, distance: number, duration = 30): number {
  return clamped(frame, [start, start + duration], [distance, 0]);
}

export function pulse(frame: number, start: number, duration = 14): number {
  return interpolate(frame, [start, start + duration / 2, start + duration], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeInOut,
  });
}
