// Manufactured commitment state machine — MASTER_SPEC §7.10.

import { defineMachine } from "../state-machine.js";

export type CommitmentState =
  | "REQUESTED"
  | "GOAL_CAPTURED"
  | "SCENARIO_PROPOSED"
  | "CONFIRMED"
  | "SCHEDULED"
  | "REMINDER_PHASE"
  | "PRESSURE_WINDOW"
  | "CANCELLATION_QUEUED"
  | "OPERATOR_ESCALATION"
  | "COMPLETED"
  | "ABORTED"
  | "DECLINED";

export type CommitmentEvent =
  | "CAPTURE_GOAL"
  | "PROPOSE_SCENARIO"
  | "CONFIRM"
  | "DECLINE"
  | "ABORT"
  | "SCHEDULE"
  | "ENTER_REMINDER_PHASE"
  | "ENTER_PRESSURE_WINDOW"
  | "QUEUE_CANCELLATION"
  | "CANCEL"
  | "ESCALATE"
  | "RECOVER";

export const commitmentMachine = defineMachine<CommitmentState, CommitmentEvent>({
  initial: "REQUESTED",
  isTerminal: (s) => s === "COMPLETED" || s === "ABORTED" || s === "DECLINED",
  transitions: [
    { from: "REQUESTED", event: "CAPTURE_GOAL", to: "GOAL_CAPTURED" },
    { from: "GOAL_CAPTURED", event: "PROPOSE_SCENARIO", to: "SCENARIO_PROPOSED" },
    { from: "SCENARIO_PROPOSED", event: "CONFIRM", to: "CONFIRMED" },
    { from: "SCENARIO_PROPOSED", event: "DECLINE", to: "DECLINED" },
    { from: "CONFIRMED", event: "SCHEDULE", to: "SCHEDULED" },
    { from: "SCHEDULED", event: "ENTER_REMINDER_PHASE", to: "REMINDER_PHASE" },
    { from: "REMINDER_PHASE", event: "ENTER_PRESSURE_WINDOW", to: "PRESSURE_WINDOW" },
    {
      from: "PRESSURE_WINDOW",
      event: "QUEUE_CANCELLATION",
      to: "CANCELLATION_QUEUED",
    },
    { from: "CANCELLATION_QUEUED", event: "CANCEL", to: "COMPLETED" },
    {
      from: "CANCELLATION_QUEUED",
      event: "ESCALATE",
      to: "OPERATOR_ESCALATION",
    },
    { from: "OPERATOR_ESCALATION", event: "RECOVER", to: "COMPLETED" },
    // Abort is permitted from any pre-completion state (member can abort at
    // any moment per MASTER_SPEC §2.7).
    { from: "REQUESTED", event: "ABORT", to: "ABORTED" },
    { from: "GOAL_CAPTURED", event: "ABORT", to: "ABORTED" },
    { from: "SCENARIO_PROPOSED", event: "ABORT", to: "ABORTED" },
    { from: "CONFIRMED", event: "ABORT", to: "ABORTED" },
    { from: "SCHEDULED", event: "ABORT", to: "ABORTED" },
    { from: "REMINDER_PHASE", event: "ABORT", to: "ABORTED" },
    { from: "PRESSURE_WINDOW", event: "ABORT", to: "ABORTED" },
    { from: "OPERATOR_ESCALATION", event: "ABORT", to: "ABORTED" },
  ],
});
