import React from "react";
import { useCurrentFrame } from "remotion";
import type { PlanProps } from "../types";
import { EndCard } from "../primitives/EndCard";

export const PlanReliefScene: React.FC<PlanProps> = ({ orientation, copy, cta }) => (
  <EndCard
    frame={useCurrentFrame()}
    title={copy.finalTitle}
    body={copy.finalBody}
    cta={cta}
    vertical={orientation === "vertical"}
    inverse
  />
);
