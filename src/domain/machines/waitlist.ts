// Waitlist state machine — MASTER_SPEC §7.1.

import { defineMachine } from "../state-machine.js";

export type WaitlistState =
  | "SUBMITTED"
  | "VALIDATED"
  | "WELCOME_QUEUED"
  | "ACTIVE_WAITLIST"
  | "RETRY"
  | "REJECTED"
  | "INVALID_EMAIL"
  | "FAILED_PERMANENTLY"
  | "CONVERTED"
  | "UNSUBSCRIBED"
  | "DELETED";

export type WaitlistEvent =
  | "VALIDATE"
  | "REJECT"
  | "QUEUE_WELCOME"
  | "DELIVER"
  | "RECORD_TRANSIENT_FAILURE"
  | "RETRY_DELIVERY"
  | "RECORD_HARD_BOUNCE"
  | "EXHAUST_RETRIES"
  | "CONVERT_TO_MEMBER"
  | "UNSUBSCRIBE"
  | "DELETE";

export const waitlistMachine = defineMachine<WaitlistState, WaitlistEvent>({
  initial: "SUBMITTED",
  isTerminal: (s) =>
    s === "REJECTED" ||
    s === "INVALID_EMAIL" ||
    s === "FAILED_PERMANENTLY" ||
    s === "CONVERTED" ||
    s === "UNSUBSCRIBED" ||
    s === "DELETED",
  transitions: [
    { from: "SUBMITTED", event: "VALIDATE", to: "VALIDATED" },
    { from: "SUBMITTED", event: "REJECT", to: "REJECTED" },
    { from: "VALIDATED", event: "QUEUE_WELCOME", to: "WELCOME_QUEUED" },
    { from: "WELCOME_QUEUED", event: "DELIVER", to: "ACTIVE_WAITLIST" },
    { from: "WELCOME_QUEUED", event: "RECORD_TRANSIENT_FAILURE", to: "RETRY" },
    { from: "WELCOME_QUEUED", event: "RECORD_HARD_BOUNCE", to: "INVALID_EMAIL" },
    { from: "RETRY", event: "DELIVER", to: "ACTIVE_WAITLIST" },
    { from: "RETRY", event: "EXHAUST_RETRIES", to: "FAILED_PERMANENTLY" },
    { from: "ACTIVE_WAITLIST", event: "CONVERT_TO_MEMBER", to: "CONVERTED" },
    { from: "ACTIVE_WAITLIST", event: "UNSUBSCRIBE", to: "UNSUBSCRIBED" },
    { from: "ACTIVE_WAITLIST", event: "DELETE", to: "DELETED" },
  ],
});
