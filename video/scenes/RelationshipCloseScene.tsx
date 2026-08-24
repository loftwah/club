import React from "react";
import { useCurrentFrame } from "remotion";
import type { RelationshipProps } from "../types";
import { EndCard } from "../primitives/EndCard";

export const RelationshipCloseScene: React.FC<RelationshipProps> = ({ orientation, copy, cta }) => (
  <EndCard
    frame={useCurrentFrame()}
    title={copy.finalTitle}
    body={copy.finalBody}
    cta={cta}
    vertical={orientation === "vertical"}
  />
);
