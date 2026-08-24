import { z } from "zod";

export const OrientationSchema = z.enum(["landscape", "vertical"]);
export type Orientation = z.infer<typeof OrientationSchema>;

export const AudioProfileSchema = z.enum(["designed", "silent"]);
export type AudioProfile = z.infer<typeof AudioProfileSchema>;

export const SafeZoneProfileSchema = z.enum(["social-ui-variable-v1", "landscape-editorial-v1"]);
export type SafeZoneProfile = z.infer<typeof SafeZoneProfileSchema>;

export const safeZoneProfileMetadata: Record<
  SafeZoneProfile,
  {
    verifiedDate: string;
    aspect: "9:16" | "16:9";
    officialSources: string[];
    sourceNotes: string;
    assumptions: string;
  }
> = {
  "social-ui-variable-v1": {
    verifiedDate: "2026-08-24",
    aspect: "9:16",
    officialSources: [
      "https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en",
      "https://www.facebook.com/business/ads/facebook-instagram-reels-ads",
    ],
    sourceNotes: "Conservative portrait social/UI framing for title, logo and CTA clearance.",
    assumptions:
      "Platform chrome varies; this is a safe editorial assumption, not a permanent platform rectangle.",
  },
  "landscape-editorial-v1": {
    verifiedDate: "2026-08-24",
    aspect: "16:9",
    officialSources: ["https://www.remotion.dev/docs/encoding"],
    sourceNotes: "Conservative 16:9 editorial framing for title, status and CTA clearance.",
    assumptions:
      "Player chrome varies; this is a safe editorial assumption, not a permanent platform rectangle.",
  },
};

export const defaultSafeZones = {
  showSafeZones: false,
  profile: "landscape-editorial-v1" as const,
  topPercent: 10,
  bottomPercent: 10,
  sidePercent: 8,
};
export const defaultVerticalSafeZones = {
  showSafeZones: false,
  profile: "social-ui-variable-v1" as const,
  topPercent: 10,
  bottomPercent: 10,
  sidePercent: 8,
};
export const defaultPreviewSafeZones = {
  showSafeZones: true,
  profile: "landscape-editorial-v1" as const,
  topPercent: 10,
  bottomPercent: 10,
  sidePercent: 8,
};
export const defaultCta = {
  label: "See how it works",
  href: "https://club.loftwah.com/how-it-works",
  note: "A quiet arrangement, made with you in mind.",
};
export const defaultPlanCopy = {
  eyebrow: "PLANS WITH YOU / ISSUE 021",
  title: "Plans were made.",
  subtitle: "Plans were unmade.",
  body: "A date can be held for you without asking you to attend.",
  planLabel: "A plan, held lightly",
  dateLabel: "OCT / 21",
  timeLabel: "7:30 PM",
  placeLabel: "NEARBY / UNDISCLOSED",
  approachingLabel: "DATE APPROACHING",
  cancellationLabel: "CANCELLED / SUCCESSFUL",
  reliefLabel: "STILL ON THE LIST",
  finalTitle: "You don't have to go.",
  finalBody: "The invitation is real. So is the freedom to let it pass.",
};
export const defaultRelationshipCopy = {
  eyebrow: "PLANS WITH YOU / CORRESPONDENCE",
  title: "A line stays open.",
  body: "Correspondence gathers without asking for a performance.",
  letterLabel: "A NOTE, WHEN IT IS TIME",
  letterBody: "We kept a place for you. Nothing else is required.",
  memberLabel: "MEMBERSHIP / STABLE",
  milestoneLabel: "A SMALL MARK OF TIME",
  finalTitle: "Still on the list.",
  finalBody: "You are wanted. You do not have to go.",
};

export const SafeZoneSchema = z.object({
  showSafeZones: z.boolean().default(false),
  profile: SafeZoneProfileSchema.default("landscape-editorial-v1"),
  topPercent: z.number().min(4).max(24).default(10),
  bottomPercent: z.number().min(4).max(24).default(10),
  sidePercent: z.number().min(4).max(20).default(8),
});
export type SafeZoneProps = z.infer<typeof SafeZoneSchema>;

export const CtaSchema = z.object({
  label: z.string().min(1).default("See how it works"),
  href: z.string().default("https://club.loftwah.com/how-it-works"),
  note: z.string().default("A quiet arrangement, made with you in mind."),
});
export type CtaProps = z.infer<typeof CtaSchema>;

export const PlanCopySchema = z.object({
  eyebrow: z.string().default("PLANS WITH YOU / ISSUE 021"),
  title: z.string().default("Plans were made."),
  subtitle: z.string().default("Plans were unmade."),
  body: z.string().default("A date can be held for you without asking you to attend."),
  planLabel: z.string().default("A plan, held lightly"),
  dateLabel: z.string().default("OCT / 21"),
  timeLabel: z.string().default("7:30 PM"),
  placeLabel: z.string().default("NEARBY / UNDISCLOSED"),
  approachingLabel: z.string().default("DATE APPROACHING"),
  cancellationLabel: z.string().default("CANCELLED / SUCCESSFUL"),
  reliefLabel: z.string().default("STILL ON THE LIST"),
  finalTitle: z.string().default("You don't have to go."),
  finalBody: z.string().default("The invitation is real. So is the freedom to let it pass."),
});
export type PlanCopy = z.infer<typeof PlanCopySchema>;

export const RelationshipCopySchema = z.object({
  eyebrow: z.string().default("PLANS WITH YOU / CORRESPONDENCE"),
  title: z.string().default("A line stays open."),
  body: z.string().default("Correspondence gathers without asking for a performance."),
  letterLabel: z.string().default("A NOTE, WHEN IT IS TIME"),
  letterBody: z.string().default("We kept a place for you. Nothing else is required."),
  memberLabel: z.string().default("MEMBERSHIP / STABLE"),
  milestoneLabel: z.string().default("A SMALL MARK OF TIME"),
  finalTitle: z.string().default("Still on the list."),
  finalBody: z.string().default("You are wanted. You do not have to go."),
});
export type RelationshipCopy = z.infer<typeof RelationshipCopySchema>;

export const PlanPropsSchema = z.object({
  orientation: OrientationSchema.default("landscape"),
  copy: PlanCopySchema.default(defaultPlanCopy),
  cta: CtaSchema.default(defaultCta),
  safeZones: SafeZoneSchema.default(defaultSafeZones),
  audioProfile: AudioProfileSchema.default("designed"),
  memberNumber: z.string().default("SAMPLE-000"),
  month: z.string().default("OCT"),
  day: z.string().default("21"),
  time: z.string().default("7:30 PM"),
  campaign: z.literal("A").default("A"),
});
export type PlanProps = z.infer<typeof PlanPropsSchema>;

export const RelationshipPropsSchema = z.object({
  orientation: OrientationSchema.default("landscape"),
  copy: RelationshipCopySchema.default(defaultRelationshipCopy),
  cta: CtaSchema.default(defaultCta),
  safeZones: SafeZoneSchema.default(defaultSafeZones),
  audioProfile: AudioProfileSchema.default("designed"),
  memberNumber: z.string().default("SAMPLE-000"),
  correspondenceCount: z.number().int().min(1).max(12).default(4),
  campaign: z.literal("B").default("B"),
});
export type RelationshipProps = z.infer<typeof RelationshipPropsSchema>;

export const PreviewPropsSchema = z.object({
  orientation: OrientationSchema.default("landscape"),
  safeZones: SafeZoneSchema.default(defaultPreviewSafeZones),
  audioProfile: AudioProfileSchema.default("silent"),
});
export type PreviewProps = z.infer<typeof PreviewPropsSchema>;

export const defaultPlanProps: PlanProps = {
  orientation: "landscape",
  copy: PlanCopySchema.parse(defaultPlanCopy),
  cta: CtaSchema.parse(defaultCta),
  safeZones: SafeZoneSchema.parse(defaultSafeZones),
  audioProfile: "designed",
  memberNumber: "SAMPLE-000",
  month: "OCT",
  day: "21",
  time: "7:30 PM",
  campaign: "A",
};

export const defaultRelationshipProps: RelationshipProps = {
  orientation: "landscape",
  copy: RelationshipCopySchema.parse(defaultRelationshipCopy),
  cta: CtaSchema.parse(defaultCta),
  safeZones: SafeZoneSchema.parse(defaultSafeZones),
  audioProfile: "designed",
  memberNumber: "SAMPLE-000",
  correspondenceCount: 4,
  campaign: "B",
};
