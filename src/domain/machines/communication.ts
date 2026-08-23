// Communication state machine — MASTER_SPEC §7.5.

import { defineMachine } from "../state-machine.js";

export type CommunicationState =
  | "DRAFT"
  | "GENERATED"
  | "VALIDATED"
  | "SCHEDULED"
  | "CANCELLED_BEFORE_SEND"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "BOUNCED"
  | "COMPLAINED"
  | "TRANSIENT_FAILURE"
  | "PERMANENT_FAILURE"
  | "REJECTED";

export type CommunicationEvent =
  | "GENERATE"
  | "VALIDATE"
  | "REJECT"
  | "SCHEDULE"
  | "CANCEL_BEFORE_SEND"
  | "QUEUE"
  | "SENT"
  | "DELIVER"
  | "BOUNCE"
  | "COMPLAIN"
  | "RECORD_TRANSIENT_FAILURE"
  | "RETRY"
  | "EXHAUST_RETRIES";

export const communicationMachine = defineMachine<CommunicationState, CommunicationEvent>({
  initial: "DRAFT",
  isTerminal: (s) =>
    s === "DELIVERED" ||
    s === "BOUNCED" ||
    s === "COMPLAINED" ||
    s === "PERMANENT_FAILURE" ||
    s === "REJECTED" ||
    s === "CANCELLED_BEFORE_SEND",
  transitions: [
    { from: "DRAFT", event: "GENERATE", to: "GENERATED" },
    { from: "GENERATED", event: "VALIDATE", to: "VALIDATED" },
    { from: "GENERATED", event: "REJECT", to: "REJECTED" },
    { from: "VALIDATED", event: "SCHEDULE", to: "SCHEDULED" },
    { from: "SCHEDULED", event: "CANCEL_BEFORE_SEND", to: "CANCELLED_BEFORE_SEND" },
    { from: "SCHEDULED", event: "QUEUE", to: "QUEUED" },
    { from: "QUEUED", event: "SENT", to: "SENT" },
    { from: "QUEUED", event: "RECORD_TRANSIENT_FAILURE", to: "TRANSIENT_FAILURE" },
    { from: "TRANSIENT_FAILURE", event: "RETRY", to: "QUEUED" },
    { from: "TRANSIENT_FAILURE", event: "EXHAUST_RETRIES", to: "PERMANENT_FAILURE" },
    { from: "SENT", event: "DELIVER", to: "DELIVERED" },
    { from: "SENT", event: "BOUNCE", to: "BOUNCED" },
    { from: "SENT", event: "COMPLAIN", to: "COMPLAINED" },
  ],
});
