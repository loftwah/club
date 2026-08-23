import { describe, expect, it } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { MockD1Database } from "../support/mock-d1";
import { loadSchema } from "../support/load-schema";
import { FixedClock } from "../../src/infra/clock";
import { InMemoryAuditWriter } from "../../src/infra/audit";
import { OnboardingService } from "../../src/services/onboarding";
import { MembershipService } from "../../src/services/membership-service";

function setup() {
  const db = new MockD1Database();
  loadSchema(db);
  const clock = FixedClock.at("2026-08-15T10:00:00.000Z");
  const audit = new InMemoryAuditWriter();
  const onboarding = new OnboardingService({ db: db as unknown as D1Database });
  const ms = new MembershipService({ db: db as unknown as D1Database, audit, clock });
  return { db, clock, audit, onboarding, ms };
}

describe("OnboardingService", () => {
  it("next step is the first step when no progress", async () => {
    const { onboarding } = setup();
    const next = await onboarding.nextStep("mem_app");
    expect(next?.id).toBe("identity");
  });

  it("next step advances after setStep", async () => {
    const { onboarding } = setup();
    await onboarding.setStep("mem_app", "identity");
    const next = await onboarding.nextStep("mem_app");
    expect(next?.id).toBe("chapter");
  });

  it("storeStepData persists and can be read back", async () => {
    const { onboarding } = setup();
    await onboarding.storeStepData("mem_app", "identity", {
      preferredName: "Applicant",
      country: "AU",
    });
    const data = await onboarding.getStepData("mem_app", "identity");
    expect(data).toEqual({ preferredName: "Applicant", country: "AU" });
  });

  it("the wizard is resumable: storeStepData updates progress", async () => {
    const { onboarding } = setup();
    await onboarding.storeStepData("mem_app", "identity", { preferredName: "A" });
    const after = await onboarding.getProgress("mem_app");
    expect(after?.step).toBe("identity");
  });
});
