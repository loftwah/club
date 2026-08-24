import React from "react";
import { Composition, Folder } from "remotion";
import { CampaignA, CampaignAVertical } from "./campaigns/CampaignA";
import { CampaignB, CampaignBVertical } from "./campaigns/CampaignB";
import { PlanArrivalScene } from "./scenes/PlanArrivalScene";
import { PlanApproachScene } from "./scenes/PlanApproachScene";
import { PlanCancellationScene } from "./scenes/PlanCancellationScene";
import { PlanDecidedScene } from "./scenes/PlanDecidedScene";
import { CorrespondenceArrivalScene } from "./scenes/CorrespondenceArrivalScene";
import { CorrespondenceGatherScene } from "./scenes/CorrespondenceGatherScene";
import { MembershipStabilityScene } from "./scenes/MembershipStabilityScene";
import { MilestoneScene } from "./scenes/MilestoneScene";
import { PrimitivePreview, type PrimitiveName } from "./primitives/PrimitivePreview";
import { SafeZonePreview } from "./qa/SafeZonePreview";
import {
  PlanPropsSchema,
  RelationshipPropsSchema,
  PreviewPropsSchema,
  defaultPlanProps,
  defaultRelationshipProps,
  defaultPreviewSafeZones,
  defaultVerticalSafeZones,
} from "./types";

const FPS = 30;
const PLAN_LANDSCAPE_DURATION = 600;
const PLAN_VERTICAL_DURATION = 480;
const RELATIONSHIP_LANDSCAPE_DURATION = 630;
const RELATIONSHIP_VERTICAL_DURATION = 480;
const LANDSCAPE = { width: 1920, height: 1080 };
const VERTICAL = { width: 1080, height: 1920 };

const planLandscape = { ...defaultPlanProps, orientation: "landscape" as const };
const planVertical = {
  ...defaultPlanProps,
  orientation: "vertical" as const,
  safeZones: defaultVerticalSafeZones,
};
const relationshipLandscape = { ...defaultRelationshipProps, orientation: "landscape" as const };
const relationshipVertical = {
  ...defaultRelationshipProps,
  orientation: "vertical" as const,
  safeZones: defaultVerticalSafeZones,
};

const PrimitiveComposition: React.FC<{ primitive: PrimitiveName }> = ({ primitive }) => (
  <PrimitivePreview
    orientation="landscape"
    primitive={primitive}
    safeZones={{ ...defaultPreviewSafeZones, showSafeZones: false }}
    audioProfile="silent"
  />
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Primitives">
        <Composition
          id="Primitive-Calendar"
          component={() => <PrimitiveComposition primitive="calendar" />}
          durationInFrames={90}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={{}}
          schema={PreviewPropsSchema}
        />
        <Composition
          id="Primitive-Cancellation"
          component={() => <PrimitiveComposition primitive="cancellation" />}
          durationInFrames={90}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={{}}
          schema={PreviewPropsSchema}
        />
        <Composition
          id="Primitive-Envelope"
          component={() => <PrimitiveComposition primitive="envelope" />}
          durationInFrames={90}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={{}}
          schema={PreviewPropsSchema}
        />
        <Composition
          id="Primitive-MembershipCard"
          component={() => <PrimitiveComposition primitive="membership" />}
          durationInFrames={90}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={{}}
          schema={PreviewPropsSchema}
        />
      </Folder>

      <Folder name="Scenes">
        <Composition
          id="Scene-PlanArrival"
          component={PlanArrivalScene}
          durationInFrames={74}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={planLandscape}
          schema={PlanPropsSchema}
        />
        <Composition
          id="Scene-PlanDecided"
          component={PlanDecidedScene}
          durationInFrames={78}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={planLandscape}
          schema={PlanPropsSchema}
        />
        <Composition
          id="Scene-PlanApproach"
          component={PlanApproachScene}
          durationInFrames={86}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={planLandscape}
          schema={PlanPropsSchema}
        />
        <Composition
          id="Scene-PlanCancellation"
          component={PlanCancellationScene}
          durationInFrames={74}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={planLandscape}
          schema={PlanPropsSchema}
        />
        <Composition
          id="Scene-CorrespondenceArrival"
          component={CorrespondenceArrivalScene}
          durationInFrames={74}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={relationshipLandscape}
          schema={RelationshipPropsSchema}
        />
        <Composition
          id="Scene-CorrespondenceGather"
          component={CorrespondenceGatherScene}
          durationInFrames={78}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={relationshipLandscape}
          schema={RelationshipPropsSchema}
        />
        <Composition
          id="Scene-MembershipStability"
          component={MembershipStabilityScene}
          durationInFrames={86}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={relationshipLandscape}
          schema={RelationshipPropsSchema}
        />
        <Composition
          id="Scene-Milestone"
          component={MilestoneScene}
          durationInFrames={74}
          fps={FPS}
          {...LANDSCAPE}
          defaultProps={relationshipLandscape}
          schema={RelationshipPropsSchema}
        />
      </Folder>

      <Folder name="Campaign-A">
        <Folder name="Landscape">
          <Composition
            id="ThePlan-Landscape"
            component={CampaignA}
            durationInFrames={PLAN_LANDSCAPE_DURATION}
            fps={FPS}
            {...LANDSCAPE}
            defaultProps={planLandscape}
            schema={PlanPropsSchema}
          />
        </Folder>
        <Folder name="Vertical">
          <Composition
            id="ThePlan-Vertical"
            component={CampaignAVertical}
            durationInFrames={PLAN_VERTICAL_DURATION}
            fps={FPS}
            {...VERTICAL}
            defaultProps={planVertical}
            schema={PlanPropsSchema}
          />
        </Folder>
      </Folder>

      <Folder name="Campaign-B">
        <Folder name="Landscape">
          <Composition
            id="TheRelationship-Landscape"
            component={CampaignB}
            durationInFrames={RELATIONSHIP_LANDSCAPE_DURATION}
            fps={FPS}
            {...LANDSCAPE}
            defaultProps={relationshipLandscape}
            schema={RelationshipPropsSchema}
          />
        </Folder>
        <Folder name="Vertical">
          <Composition
            id="TheRelationship-Vertical"
            component={CampaignBVertical}
            durationInFrames={RELATIONSHIP_VERTICAL_DURATION}
            fps={FPS}
            {...VERTICAL}
            defaultProps={relationshipVertical}
            schema={RelationshipPropsSchema}
          />
        </Folder>
      </Folder>

      <Folder name="QA">
        <Folder name="Safe-Zones">
          <Composition
            id="QA-SafeZones-Landscape"
            component={SafeZonePreview}
            durationInFrames={90}
            fps={FPS}
            {...LANDSCAPE}
            defaultProps={{
              orientation: "landscape",
              safeZones: defaultPreviewSafeZones,
              audioProfile: "silent",
            }}
            schema={PreviewPropsSchema}
          />
          <Composition
            id="QA-SafeZones-Vertical"
            component={SafeZonePreview}
            durationInFrames={90}
            fps={FPS}
            {...VERTICAL}
            defaultProps={{
              orientation: "vertical",
              safeZones: { ...defaultPreviewSafeZones, profile: "social-ui-variable-v1" },
              audioProfile: "silent",
            }}
            schema={PreviewPropsSchema}
          />
        </Folder>
      </Folder>
    </>
  );
};
