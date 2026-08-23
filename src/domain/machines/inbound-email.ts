// Inbound email state machine — MASTER_SPEC §7.6.
//
// Important: the email.received webhook from Resend is metadata only.
// The body and attachments must be fetched via the Resend Received Emails
// API by email_id. See MASTER_SPEC §9.6 and docs/08_RESEND_EMAIL_CALENDAR.md.

import { defineMachine } from "../state-machine.js";

export type InboundState =
  | "RECEIVED"
  | "SIGNATURE_VERIFIED"
  | "STORED"
  | "FETCHING_BODY"
  | "FETCH_FAILED"
  | "MATCHED"
  | "UNMATCHED"
  | "CLASSIFIED"
  | "AUTO_HANDLED"
  | "HUMAN_REVIEW"
  | "SAFE_NO_ACTION"
  | "CLOSED"
  | "REJECTED"
  | "ACKNOWLEDGED_NOOP"
  | "QUARANTINED"
  | "PERMANENT_FAILURE";

export type InboundEvent =
  | "VERIFY_SIGNATURE"
  | "REJECT_SIGNATURE"
  | "PERSIST_METADATA"
  | "FETCH_BODY"
  | "BODY_FETCHED"
  | "BODY_FETCH_FAILED"
  | "RETRY_FETCH"
  | "ESCALATE_FETCH"
  | "MATCH_SENDER"
  | "MARK_UNMATCHED"
  | "CLASSIFY"
  | "AUTO_HANDLE"
  | "ROUTE_TO_HUMAN"
  | "MARK_SAFE_NO_ACTION"
  | "ACK_DUPLICATE"
  | "QUARANTINE"
  | "CLOSE";

export const inboundEmailMachine = defineMachine<InboundState, InboundEvent>({
  initial: "RECEIVED",
  isTerminal: (s) =>
    s === "CLOSED" ||
    s === "REJECTED" ||
    s === "ACKNOWLEDGED_NOOP" ||
    s === "QUARANTINED" ||
    s === "PERMANENT_FAILURE",
  transitions: [
    { from: "RECEIVED", event: "VERIFY_SIGNATURE", to: "SIGNATURE_VERIFIED" },
    { from: "RECEIVED", event: "REJECT_SIGNATURE", to: "REJECTED" },
    { from: "RECEIVED", event: "ACK_DUPLICATE", to: "ACKNOWLEDGED_NOOP" },
    { from: "RECEIVED", event: "QUARANTINE", to: "QUARANTINED" },
    { from: "SIGNATURE_VERIFIED", event: "PERSIST_METADATA", to: "STORED" },
    { from: "STORED", event: "FETCH_BODY", to: "FETCHING_BODY" },
    { from: "FETCHING_BODY", event: "BODY_FETCHED", to: "STORED" },
    { from: "FETCHING_BODY", event: "BODY_FETCH_FAILED", to: "FETCH_FAILED" },
    { from: "FETCH_FAILED", event: "RETRY_FETCH", to: "FETCHING_BODY" },
    {
      from: "FETCH_FAILED",
      event: "ESCALATE_FETCH",
      to: "PERMANENT_FAILURE",
    },
    { from: "STORED", event: "MATCH_SENDER", to: "MATCHED" },
    { from: "STORED", event: "MARK_UNMATCHED", to: "UNMATCHED" },
    { from: "MATCHED", event: "CLASSIFY", to: "CLASSIFIED" },
    { from: "UNMATCHED", event: "CLASSIFY", to: "CLASSIFIED" },
    { from: "CLASSIFIED", event: "AUTO_HANDLE", to: "AUTO_HANDLED" },
    { from: "CLASSIFIED", event: "ROUTE_TO_HUMAN", to: "HUMAN_REVIEW" },
    { from: "CLASSIFIED", event: "MARK_SAFE_NO_ACTION", to: "SAFE_NO_ACTION" },
    { from: "AUTO_HANDLED", event: "CLOSE", to: "CLOSED" },
    { from: "HUMAN_REVIEW", event: "CLOSE", to: "CLOSED" },
    { from: "SAFE_NO_ACTION", event: "CLOSE", to: "CLOSED" },
  ],
});
