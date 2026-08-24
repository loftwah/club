// Production cadence policy (LOCKED).
//
// This is the single source of truth for the event and cancellation
// cadence. Per the locked product spec:
//
//   Normal invitation frequency: 1–2 constructed engagements per
//   member per month, with natural variation so the system does not
//   feel robotic.
//
//   Invitation lead time: 7–21 days before the constructed event.
//
//   Default cancellation window: 12–36 hours before event start.
//   Some cancellations land earlier (Merciful) and some later
//   (Last Minute), but never after the event has begun.
//
//   Cancellation styles:
//     - Merciful:    48–72 hours before
//     - Traditional: 12–36 hours before
//     - Last Minute: 2–8 hours before
//
//   New members default to Traditional. The safety monitor remains
//   authoritative and may force an earlier cancellation.

export const cadence = {
  invitations: {
    /** Target invitations per month for a member with the default preset. */
    perMonth: { min: 1, max: 2 } as const,
    /** Lead time before the constructed event, in hours. */
    leadHours: { min: 7 * 24, max: 21 * 24 } as const,
  },
  cancellations: {
    /** Default cancellation window for new members. */
    defaultStyle: "traditional" as const,
    /** Hours-before-event for each cancellation style. */
    styles: {
      merciful: { minHours: 48, maxHours: 72 },
      traditional: { minHours: 12, maxHours: 36 },
      "last-minute": { minHours: 2, maxHours: 8 },
    } as const,
    /** Hard safety rule — never cancel after the event has begun. */
    neverAfterStart: true as const,
  },
  eventVariety: {
    /** Encourage type/day/time/neighbourhood/tone variation. */
    vary: ["type", "day", "time", "neighbourhood", "scale", "tone", "leadTime", "reason"] as const,
  },
  cancellationReasons: [
    "organiser circumstances",
    "scheduling conflict",
    "venue or logistical issue",
    "weather",
    "insufficient alignment of circumstances",
    "administrative problem",
    "a quiet matter of the diary",
    "the date simply passed",
    "the room turned out to be wrong",
    "the host was unexpectedly called away",
  ] as const,
} as const;

export type CancellationStyle = keyof typeof cadence.cancellations.styles;
