// Human fulfilment state machine — MASTER_SPEC §7.7.

import { defineMachine } from "../state-machine.js";

export type FulfilmentState =
  | "CREATED"
  | "OPERATOR_NOTIFIED"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "OVERDUE"
  | "ESCALATED"
  | "BLOCKED"
  | "RESCHEDULED";

export type FulfilmentEvent =
  | "NOTIFY_OPERATOR"
  | "ACKNOWLEDGE"
  | "START"
  | "COMPLETE"
  | "CANCEL"
  | "BECOME_OVERDUE"
  | "ESCALATE"
  | "BLOCK"
  | "UNBLOCK"
  | "RESCHEDULE";

export const fulfilmentMachine = defineMachine<FulfilmentState, FulfilmentEvent>({
  initial: "CREATED",
  isTerminal: (s) => s === "COMPLETED" || s === "CANCELLED",
  transitions: [
    { from: "CREATED", event: "NOTIFY_OPERATOR", to: "OPERATOR_NOTIFIED" },
    { from: "OPERATOR_NOTIFIED", event: "ACKNOWLEDGE", to: "ACKNOWLEDGED" },
    { from: "OPERATOR_NOTIFIED", event: "BECOME_OVERDUE", to: "OVERDUE" },
    { from: "ACKNOWLEDGED", event: "START", to: "IN_PROGRESS" },
    { from: "ACKNOWLEDGED", event: "RESCHEDULE", to: "RESCHEDULED" },
    { from: "IN_PROGRESS", event: "COMPLETE", to: "COMPLETED" },
    { from: "IN_PROGRESS", event: "BLOCK", to: "BLOCKED" },
    { from: "BLOCKED", event: "UNBLOCK", to: "IN_PROGRESS" },
    { from: "BLOCKED", event: "CANCEL", to: "CANCELLED" },
    { from: "OVERDUE", event: "ESCALATE", to: "ESCALATED" },
    { from: "ESCALATED", event: "START", to: "IN_PROGRESS" },
    { from: "RESCHEDULED", event: "NOTIFY_OPERATOR", to: "OPERATOR_NOTIFIED" },
  ],
});
