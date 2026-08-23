// Onboarding wizard state machine + service.
//
// The customer-facing onboarding flow has a sequence of steps:
//   identity → chapter → tier → why → event preferences → comms
//   → memory → post → gifts → calls → manufactured commitments
//   → appearance interest → plain-language → terms → payment gate
//
// Each step persists its own subset of the record. The wizard
// must be resumable: a member can leave at any step and pick up
// where they left off. The wizard must show completion and
// remaining blockers, and must NOT activate a paid member
// without the required gates.

import type { D1Database } from "@cloudflare/workers-types";

export type OnboardingStepId =
  | "identity"
  | "chapter"
  | "tier"
  | "why"
  | "event-preferences"
  | "communications"
  | "memory"
  | "post"
  | "gifts"
  | "calls"
  | "manufactured-commitments"
  | "appearance-interest"
  | "plain-language"
  | "terms"
  | "payment-gate";

export interface OnboardingStep {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly description: string;
  readonly order: number;
  /** When true, the step is required for paid activation. */
  readonly requiredForActivation: boolean;
}

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStep> = [
  {
    id: "identity",
    title: "Identity",
    description: "Email, name, country, metro area, birthday, timezone.",
    order: 1,
    requiredForActivation: true,
  },
  {
    id: "chapter",
    title: "Chapter",
    description: "Where you are. Determines which chapter letters and local events you receive.",
    order: 2,
    requiredForActivation: true,
  },
  {
    id: "tier",
    title: "Tier",
    description:
      "A$5 / A$20 / A$50. Tier grants capabilities; the service grant is the on/off switch.",
    order: 3,
    requiredForActivation: true,
  },
  {
    id: "why",
    title: "Why are you joining?",
    description: "Multi-select alignment form.",
    order: 4,
    requiredForActivation: true,
  },
  {
    id: "event-preferences",
    title: "Event preferences",
    description: "Frequency, types, timing, geography, cancellation style.",
    order: 5,
    requiredForActivation: false,
  },
  {
    id: "communications",
    title: "Communications",
    description: "Newsletter, calendar, postal, calls, gifts.",
    order: 6,
    requiredForActivation: false,
  },
  {
    id: "memory",
    title: "Memory preferences",
    description: "What the Society may remember, and what it must never mention.",
    order: 7,
    requiredForActivation: false,
  },
  {
    id: "post",
    title: "Physical post preferences",
    description: "Address, postal name, what to send, surprise packages.",
    order: 8,
    requiredForActivation: false,
  },
  {
    id: "gifts",
    title: "Gift preferences",
    description: "Enabled/disabled, surprises, exclusions, interests, never-send notes.",
    order: 9,
    requiredForActivation: false,
  },
  {
    id: "calls",
    title: "Call preferences",
    description:
      "Mode (no calls / birthday / milestone / occasional / all), windows, timezone, voicemail, surprise-call permission.",
    order: 10,
    requiredForActivation: false,
  },
  {
    id: "manufactured-commitments",
    title: "Manufactured commitments",
    description: "Opt-in only. Every scenario requires separate confirmation.",
    order: 11,
    requiredForActivation: false,
  },
  {
    id: "appearance-interest",
    title: "Appearance service interest",
    description: "Interested / not / ask later. Not a booking.",
    order: 12,
    requiredForActivation: false,
  },
  {
    id: "plain-language",
    title: "Plain-language expectations",
    description: "Acknowledge the product's theatrical / cancellation nature.",
    order: 13,
    requiredForActivation: true,
  },
  {
    id: "terms",
    title: "Terms & privacy",
    description: "Versioned. Stored with content hash.",
    order: 14,
    requiredForActivation: true,
  },
  {
    id: "payment-gate",
    title: "Payment gate",
    description: "Stripe-authoritative activation. Disabled in this build.",
    order: 15,
    requiredForActivation: true,
  },
];

export interface OnboardingProgress {
  readonly memberId: string;
  readonly step: OnboardingStepId;
  readonly updatedAt: string;
}

export interface OnboardingServiceDeps {
  readonly db: D1Database;
}

export class OnboardingService {
  constructor(private readonly deps: OnboardingServiceDeps) {}

  async getProgress(memberId: string): Promise<OnboardingProgress | null> {
    const row = await this.deps.db
      .prepare(`SELECT member_id, step, updated_at FROM onboarding_progress WHERE member_id = ?`)
      .bind(memberId)
      .first<{ member_id: string; step: OnboardingStepId; updated_at: string }>();
    if (!row) return null;
    return {
      memberId: row.member_id,
      step: row.step,
      updatedAt: row.updated_at,
    };
  }

  async setStep(memberId: string, step: OnboardingStepId): Promise<void> {
    const now = new Date().toISOString();
    await this.deps.db
      .prepare(
        `INSERT INTO onboarding_progress (member_id, step, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(member_id) DO UPDATE SET step = excluded.step, updated_at = excluded.updated_at`,
      )
      .bind(memberId, step, now)
      .run();
  }

  async storeStepData(
    memberId: string,
    step: OnboardingStepId,
    data: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.deps.db
      .prepare(
        `INSERT INTO onboarding_step_data (member_id, step, data_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(member_id, step) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
      )
      .bind(memberId, step, JSON.stringify(data), now)
      .run();
    await this.setStep(memberId, step);
  }

  async getStepData<T = Record<string, unknown>>(
    memberId: string,
    step: OnboardingStepId,
  ): Promise<T | null> {
    const row = await this.deps.db
      .prepare(`SELECT data_json FROM onboarding_step_data WHERE member_id = ? AND step = ?`)
      .bind(memberId, step)
      .first<{ data_json: string }>();
    if (!row) return null;
    try {
      return JSON.parse(row.data_json) as T;
    } catch {
      return null;
    }
  }

  /**
   * Return the next step the member should visit, given their
   * current progress. Returns null if all steps are complete.
   */
  async nextStep(memberId: string): Promise<OnboardingStep | null> {
    const progress = await this.getProgress(memberId);
    const currentOrder = progress
      ? (ONBOARDING_STEPS.find((s) => s.id === progress.step)?.order ?? 0)
      : 0;
    return ONBOARDING_STEPS.find((s) => s.order === currentOrder + 1) ?? null;
  }
}
