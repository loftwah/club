import { describe, expect, it } from "vitest";
import { cadence, type CancellationStyle } from "../../src/brand/cadence";

describe("cadence policy", () => {
  it("targets 1-2 invitations per month", () => {
    expect(cadence.invitations.perMonth.min).toBe(1);
    expect(cadence.invitations.perMonth.max).toBe(2);
  });

  it("invitations arrive 7-21 days before the constructed event", () => {
    expect(cadence.invitations.leadHours.min).toBe(7 * 24);
    expect(cadence.invitations.leadHours.max).toBe(21 * 24);
  });

  it("default cancellation style is traditional", () => {
    expect(cadence.cancellations.defaultStyle).toBe("traditional");
  });

  it("cancellation styles are within 2-72 hours before the event", () => {
    for (const style of Object.keys(cadence.cancellations.styles) as CancellationStyle[]) {
      const { minHours, maxHours } = cadence.cancellations.styles[style];
      expect(minHours).toBeGreaterThanOrEqual(2);
      expect(maxHours).toBeLessThanOrEqual(72);
      expect(minHours).toBeLessThanOrEqual(maxHours);
    }
  });

  it("never cancels after the event has begun", () => {
    expect(cadence.cancellations.neverAfterStart).toBe(true);
  });

  it("exposes a cancellation reason taxonomy that is plausibly varied", () => {
    expect(cadence.cancellationReasons.length).toBeGreaterThanOrEqual(5);
    const distinct = new Set(cadence.cancellationReasons);
    expect(distinct.size).toBe(cadence.cancellationReasons.length);
  });

  it("event variety axes are non-empty", () => {
    expect(cadence.eventVariety.vary.length).toBeGreaterThanOrEqual(4);
  });
});
