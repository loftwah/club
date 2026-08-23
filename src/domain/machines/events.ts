// Ordinary event state machine.
//
// Encodes MASTER_SPEC §7.4. The forbidden states ATTENDED / CHECKED_IN /
// NO_SHOW are NOT in the transition table on purpose: there is no real
// attendance reality to represent. Adding those states would invent a
// fact about the member that the system has no business knowing.

import { defineMachine } from "../state-machine.js";

export type EventState =
  | "DRAFT"
  | "VALIDATING"
  | "APPROVED"
  | "SCHEDULED"
  | "INVITATIONS_QUEUED"
  | "INVITED"
  | "REMINDER_WINDOW"
  | "CANCELLATION_QUEUED"
  | "CANCELLED"
  | "CALENDAR_CANCELLATION_PROCESSED"
  | "SEND_FAILURE"
  | "CANCELLATION_FAILURE"
  | "CRITICAL_OPERATOR_ACTION"
  | "ABANDONED"
  | "ARCHIVED";

export type EventEvent =
  | "SUBMIT_FOR_VALIDATION"
  | "MARK_VALID"
  | "RETURN_FOR_FIXES"
  | "ABANDON_DRAFT"
  | "SCHEDULE"
  | "QUEUE_INVITATIONS"
  | "MARK_INVITED"
  | "RECORD_SEND_FAILURE"
  | "RETRY_INVITATIONS"
  | "EXHAUST_INVITATION_RETRIES"
  | "ENTER_REMINDER_WINDOW"
  | "QUEUE_CANCELLATION"
  | "CANCEL"
  | "RECORD_CANCELLATION_FAILURE"
  | "RETRY_CANCELLATION"
  | "ESCALATE_TO_OPERATOR"
  | "RECOVER_VIA_OPERATOR"
  | "PROCESS_CALENDAR_CANCELLATION"
  | "ARCHIVE";

export const ordinaryEventMachine = defineMachine<EventState, EventEvent>({
  initial: "DRAFT",
  isTerminal: (s) => s === "ARCHIVED" || s === "ABANDONED",
  transitions: [
    { from: "DRAFT", event: "SUBMIT_FOR_VALIDATION", to: "VALIDATING" },
    { from: "VALIDATING", event: "RETURN_FOR_FIXES", to: "DRAFT", reasonCode: "FIXABLE" },
    { from: "VALIDATING", event: "ABANDON_DRAFT", to: "ABANDONED", reasonCode: "UNUSABLE" },
    { from: "VALIDATING", event: "MARK_VALID", to: "APPROVED" },
    { from: "APPROVED", event: "SCHEDULE", to: "SCHEDULED" },
    { from: "SCHEDULED", event: "QUEUE_INVITATIONS", to: "INVITATIONS_QUEUED" },
    {
      from: "INVITATIONS_QUEUED",
      event: "MARK_INVITED",
      to: "INVITED",
    },
    {
      from: "INVITATIONS_QUEUED",
      event: "RECORD_SEND_FAILURE",
      to: "SEND_FAILURE",
    },
    {
      from: "SEND_FAILURE",
      event: "RETRY_INVITATIONS",
      to: "INVITATIONS_QUEUED",
      reasonCode: "RETRY",
    },
    {
      from: "SEND_FAILURE",
      event: "EXHAUST_INVITATION_RETRIES",
      to: "REMINDER_WINDOW",
      reasonCode: "OPERATOR_REVIEW",
    },
    { from: "INVITED", event: "ENTER_REMINDER_WINDOW", to: "REMINDER_WINDOW" },
    {
      from: "REMINDER_WINDOW",
      event: "QUEUE_CANCELLATION",
      to: "CANCELLATION_QUEUED",
    },
    {
      from: "CANCELLATION_QUEUED",
      event: "CANCEL",
      to: "CANCELLED",
    },
    {
      from: "CANCELLATION_QUEUED",
      event: "RECORD_CANCELLATION_FAILURE",
      to: "CANCELLATION_FAILURE",
    },
    {
      from: "CANCELLATION_FAILURE",
      event: "RETRY_CANCELLATION",
      to: "CANCELLATION_QUEUED",
      reasonCode: "PRIORITY_RETRY",
    },
    {
      from: "CANCELLATION_FAILURE",
      event: "ESCALATE_TO_OPERATOR",
      to: "CRITICAL_OPERATOR_ACTION",
      reasonCode: "DEADLINE_AT_RISK",
    },
    {
      from: "CRITICAL_OPERATOR_ACTION",
      event: "RECOVER_VIA_OPERATOR",
      to: "CANCELLED",
    },
    {
      from: "CANCELLED",
      event: "PROCESS_CALENDAR_CANCELLATION",
      to: "CALENDAR_CANCELLATION_PROCESSED",
    },
    {
      from: "CALENDAR_CANCELLATION_PROCESSED",
      event: "ARCHIVE",
      to: "ARCHIVED",
    },
  ],
});
