// Policy engine.
//
// The single chokepoint that decides whether an action is allowed for a
// given member at a given moment. Every domain service that wants to act on
// a member's behalf goes through this. AI cannot override it (invariant 7).
//
// Inputs:
//   - membership state
//   - tier entitlement
//   - service grant
//   - explicit member preference
//   - current consent
//   - prerequisites
//   - budget
//   - safety rule
//   - state transition
//   - idempotency / duplicate status
//
// See MASTER_SPEC §8.1 and docs/06.

export type Capability =
  | "EVENTS"
  | "NEWSLETTER"
  | "MEMBER_MEMORY"
  | "DIGITAL_BIRTHDAY"
  | "PHYSICAL_WELCOME"
  | "PHYSICAL_CORRESPONDENCE"
  | "MILESTONE_ARTEFACT"
  | "MANUFACTURED_COMMITMENTS"
  | "GIFTS"
  | "CALLS"
  | "PREMIUM_HUMAN_ATTENTION"
  | "APPEARANCE_MEMBER_BENEFIT";

export interface PolicyContext {
  readonly membershipState: MembershipState;
  readonly tierId: string | null;
  readonly tierCapabilities: ReadonlySet<Capability>;
  readonly serviceGrantState: ServiceGrantState | null;
  readonly explicitOptOut: boolean;
  readonly consentCurrent: boolean;
  readonly termsCurrent: boolean;
  readonly billingActive: boolean;
  readonly chapterSupported: boolean;
  readonly safetyBlocked: boolean;
  readonly duplicate: boolean;
}

export type MembershipState =
  | "APPLICANT"
  | "EMAIL_VERIFIED"
  | "IDENTITY_COMPLETE"
  | "CHAPTER_RESOLUTION"
  | "TIER_SELECTED"
  | "PREFERENCES_COMPLETE"
  | "SERVICES_SELECTED"
  | "ALIGNMENT_COMPLETE"
  | "CONSENTS_COMPLETE"
  | "TERMS_ACCEPTED"
  | "PAYMENT_PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED"
  | "WAITLIST_ONLY"
  | "ABANDONED"
  | "NOT_ACTIVATED";

export type ServiceGrantState =
  "AVAILABLE" | "OPTED_IN" | "OPTED_OUT" | "INELIGIBLE" | "PAUSED" | "SUSPENDED";

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly evidence: ReadonlyArray<string>;
}

/**
 * Decide whether a member can perform `capability` in `context`.
 * `evidence` is a list of human-readable reasons (positive and negative)
 * that justify the decision. Useful for audit and debugging.
 */
export function canPerform(capability: Capability, context: PolicyContext): PolicyDecision {
  const evidence: string[] = [];

  // Universal gates first.
  if (context.safetyBlocked) {
    return deny(["SAFETY_BLOCKED"], "Safety rule blocks this action.");
  }
  if (context.duplicate) {
    return deny(["DUPLICATE"], "Duplicate of an already-applied effect.");
  }

  // Membership must be ACTIVE (with a small exception list).
  const activeCapable: ReadonlyArray<Capability> = [
    "DIGITAL_BIRTHDAY",
    "NEWSLETTER",
    "MEMBER_MEMORY",
    "EVENTS",
  ];
  if (!activeCapable.includes(capability) && context.membershipState !== "ACTIVE") {
    return deny(
      ["MEMBERSHIP_NOT_ACTIVE"],
      `Capability ${capability} requires ACTIVE membership; current state ${context.membershipState}.`,
    );
  }
  if (activeCapable.includes(capability) && context.membershipState === "CANCELLED") {
    return deny(
      ["MEMBERSHIP_CANCELLED"],
      "Cancelled members do not receive active-only capabilities.",
    );
  }
  evidence.push(`membership_state=${context.membershipState}`);

  // Tier entitlement. The capabilities set is the single source of
  // truth; tierId is informational for audit. If the tier is
  // unknown, the capabilities set still gates the decision.
  if (!context.tierCapabilities.has(capability)) {
    return deny(
      ["TIER_DOES_NOT_GRANT_CAPABILITY"],
      `Tier ${context.tierId ?? "none"} does not grant capability ${capability}.`,
    );
  }
  evidence.push(`tier=${context.tierId ?? "unknown"} grants ${capability}`);

  // Service grant state. Member opt-out always wins (invariant 9).
  if (context.explicitOptOut) {
    return deny(["MEMBER_OPTED_OUT"], "Member has opted out of this service.");
  }
  if (context.serviceGrantState === "OPTED_OUT") {
    return deny(["GRANT_OPTED_OUT"], "Service grant is OPTED_OUT.");
  }
  if (context.serviceGrantState === "SUSPENDED" || context.serviceGrantState === "PAUSED") {
    return deny(
      ["GRANT_NOT_ACTIVE"],
      `Service grant state is ${context.serviceGrantState}; member must reconsent.`,
    );
  }
  if (context.serviceGrantState === "INELIGIBLE") {
    return deny(["GRANT_INELIGIBLE"], "Service grant is INELIGIBLE for this member.");
  }
  evidence.push(`grant_state=${context.serviceGrantState ?? "default-AVAILABLE"}`);

  // Consent and terms. For higher-touch capabilities, both must be current.
  if (!activeCapable.includes(capability) && (!context.consentCurrent || !context.termsCurrent)) {
    return deny(
      ["CONSENT_OR_TERMS_OUTDATED"],
      `consent_current=${context.consentCurrent} terms_current=${context.termsCurrent}`,
    );
  }
  evidence.push(
    `consent=${context.consentCurrent} terms=${context.termsCurrent} billing=${context.billingActive}`,
  );

  // Billing gate for paid-tier capabilities.
  if (capability !== "NEWSLETTER" && !context.billingActive) {
    return deny(["BILLING_NOT_ACTIVE"], "Billing is not active for this member.");
  }

  // Chapter support. Some capabilities require a supported chapter.
  if (capability !== "NEWSLETTER" && capability !== "MEMBER_MEMORY" && !context.chapterSupported) {
    return deny(
      ["CHAPTER_UNSUPPORTED"],
      "Member's chapter is not yet supported; only waitlist is available.",
    );
  }

  return {
    allowed: true,
    reason: `Allowed: ${capability}`,
    evidence,
  };
}

function deny(evidence: string[], reason: string): PolicyDecision {
  return { allowed: false, reason, evidence };
}

/**
 * Build a context for a member who is on the waitlist. Useful for
 * the MVP waiting-list-first launch.
 */
export function waitlistContext(chapterSupported: boolean): PolicyContext {
  return {
    membershipState: "WAITLIST_ONLY",
    tierId: null,
    tierCapabilities: new Set(),
    serviceGrantState: null,
    explicitOptOut: false,
    consentCurrent: true,
    termsCurrent: true,
    billingActive: false,
    chapterSupported,
    safetyBlocked: false,
    duplicate: false,
  };
}
