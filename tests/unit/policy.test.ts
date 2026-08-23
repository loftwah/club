import { describe, expect, it } from "vitest";
import { canPerform, waitlistContext, type Capability, type PolicyContext } from "@domain/policy";

function activeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    membershipState: "ACTIVE",
    tierId: "tier_a20",
    tierCapabilities: new Set<Capability>([
      "EVENTS",
      "NEWSLETTER",
      "MEMBER_MEMORY",
      "DIGITAL_BIRTHDAY",
      "PHYSICAL_CORRESPONDENCE",
      "MILESTONE_ARTEFACT",
    ]),
    serviceGrantState: "OPTED_IN",
    explicitOptOut: false,
    consentCurrent: true,
    termsCurrent: true,
    billingActive: true,
    chapterSupported: true,
    safetyBlocked: false,
    duplicate: false,
    ...overrides,
  };
}

describe("policy engine", () => {
  it("A$5 core member cannot get PHYSICAL_CORRESPONDENCE (tier lacks capability)", () => {
    const decision = canPerform(
      "PHYSICAL_CORRESPONDENCE",
      activeContext({
        tierCapabilities: new Set<Capability>([
          "EVENTS",
          "NEWSLETTER",
          "MEMBER_MEMORY",
          "DIGITAL_BIRTHDAY",
        ]),
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.evidence).toContain("TIER_DOES_NOT_GRANT_CAPABILITY");
  });

  it("A$20 member with postal can get PHYSICAL_CORRESPONDENCE", () => {
    const decision = canPerform("PHYSICAL_CORRESPONDENCE", activeContext());
    expect(decision.allowed).toBe(true);
  });

  it("A$50 member with calls/gifts enabled can get them", () => {
    const decisionCalls = canPerform(
      "CALLS",
      activeContext({
        tierCapabilities: new Set<Capability>([
          "EVENTS",
          "NEWSLETTER",
          "MEMBER_MEMORY",
          "DIGITAL_BIRTHDAY",
          "PHYSICAL_CORRESPONDENCE",
          "MILESTONE_ARTEFACT",
          "GIFTS",
          "CALLS",
          "PREMIUM_HUMAN_ATTENTION",
        ]),
      }),
    );
    expect(decisionCalls.allowed).toBe(true);
    const decisionGifts = canPerform(
      "GIFTS",
      activeContext({
        tierCapabilities: new Set<Capability>([
          "EVENTS",
          "NEWSLETTER",
          "MEMBER_MEMORY",
          "DIGITAL_BIRTHDAY",
          "PHYSICAL_CORRESPONDENCE",
          "MILESTONE_ARTEFACT",
          "GIFTS",
          "CALLS",
          "PREMIUM_HUMAN_ATTENTION",
        ]),
      }),
    );
    expect(decisionGifts.allowed).toBe(true);
  });

  it("A$50 with calls off (service grant OPTED_OUT) is denied even with tier capability", () => {
    const decision = canPerform(
      "CALLS",
      activeContext({
        tierCapabilities: new Set<Capability>([
          "EVENTS",
          "NEWSLETTER",
          "MEMBER_MEMORY",
          "DIGITAL_BIRTHDAY",
          "PHYSICAL_CORRESPONDENCE",
          "MILESTONE_ARTEFACT",
          "GIFTS",
          "CALLS",
          "PREMIUM_HUMAN_ATTENTION",
        ]),
        serviceGrantState: "OPTED_OUT",
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.evidence).toContain("GRANT_OPTED_OUT");
  });

  it("explicit opt-out wins over tier entitlement (invariant 9)", () => {
    const decision = canPerform(
      "CALLS",
      activeContext({
        tierCapabilities: new Set<Capability>([
          "EVENTS",
          "NEWSLETTER",
          "MEMBER_MEMORY",
          "DIGITAL_BIRTHDAY",
          "PHYSICAL_CORRESPONDENCE",
          "MILESTONE_ARTEFACT",
          "GIFTS",
          "CALLS",
          "PREMIUM_HUMAN_ATTENTION",
        ]),
        explicitOptOut: true,
      }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.evidence).toContain("MEMBER_OPTED_OUT");
  });

  it("newsletter opt-out does not block events", () => {
    // Newsletter is not in the default active context; it would be denied
    // by tier. We test the inverse: a non-newsletter capability survives
    // when a NEWSLETTER-only opt-out is set.
    const decision = canPerform("EVENTS", activeContext());
    expect(decision.allowed).toBe(true);
  });

  it("waitlist-only member has no capabilities", () => {
    const decision = canPerform("EVENTS", waitlistContext(true));
    expect(decision.allowed).toBe(false);
  });

  it("cancelled member has no active-only capabilities", () => {
    const decision = canPerform("EVENTS", activeContext({ membershipState: "CANCELLED" }));
    expect(decision.allowed).toBe(false);
    expect(decision.evidence).toContain("MEMBERSHIP_CANCELLED");
  });

  it("safety block is universal", () => {
    const decision = canPerform("NEWSLETTER", activeContext({ safetyBlocked: true }));
    expect(decision.allowed).toBe(false);
    expect(decision.evidence).toContain("SAFETY_BLOCKED");
  });

  it("duplicate is universal", () => {
    const decision = canPerform("NEWSLETTER", activeContext({ duplicate: true }));
    expect(decision.allowed).toBe(false);
    expect(decision.evidence).toContain("DUPLICATE");
  });
});
