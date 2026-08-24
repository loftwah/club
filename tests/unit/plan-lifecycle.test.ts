import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_PLAN_LIFECYCLE_STATES,
  PLAN_LIFECYCLE_STATES,
  assertPlanLifecycleState,
  isForbiddenPlanLifecycleState,
  isPlanLifecycleState,
  isSuccessfulPlanFulfilment,
  nextPlanLifecycleState,
} from "../../src/components/plan-lifecycle/PlanLifecycle";

describe("plan lifecycle primitive", () => {
  it("keeps the intended order and only advances one adjacent state", () => {
    expect(PLAN_LIFECYCLE_STATES).toEqual([
      "invited",
      "planned",
      "approaching",
      "cancelled",
      "archived",
    ]);

    expect(
      PLAN_LIFECYCLE_STATES.slice(0, -1).map((state) => nextPlanLifecycleState(state)),
    ).toEqual(["planned", "approaching", "cancelled", "archived"]);
    expect(nextPlanLifecycleState("archived")).toBeUndefined();
  });

  it("treats cancellation as successful fulfilment", () => {
    expect(isSuccessfulPlanFulfilment("cancelled")).toBe(true);
    expect(isSuccessfulPlanFulfilment("archived")).toBe(true);
    expect(isSuccessfulPlanFulfilment("approaching")).toBe(false);
  });

  it("rejects attendance and RSVP states", () => {
    for (const state of FORBIDDEN_PLAN_LIFECYCLE_STATES) {
      expect(isPlanLifecycleState(state)).toBe(false);
      expect(isForbiddenPlanLifecycleState(state)).toBe(true);
      expect(() => assertPlanLifecycleState(state)).toThrow(/Forbidden plan lifecycle state/);
    }

    expect(isPlanLifecycleState("planned")).toBe(true);
    expect(isForbiddenPlanLifecycleState("planned")).toBe(false);
  });

  it("rejects unknown states instead of silently creating a pending state", () => {
    expect(() => assertPlanLifecycleState("pending")).toThrow(/Unknown plan lifecycle state/);
  });
});
