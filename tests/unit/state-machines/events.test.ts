import { describe, expect, it } from "vitest";
import { ordinaryEventMachine, type EventState } from "@domain/machines/events";
import { applyTransition } from "@domain/state-machine";

describe("ordinary event state machine", () => {
  it("reaches CANCELLED → ARCHIVED on the happy path", () => {
    const path = [
      "DRAFT",
      "VALIDATING",
      "APPROVED",
      "SCHEDULED",
      "INVITATIONS_QUEUED",
      "INVITED",
      "REMINDER_WINDOW",
      "CANCELLATION_QUEUED",
      "CANCELLED",
      "CALENDAR_CANCELLATION_PROCESSED",
      "ARCHIVED",
    ] as const;
    let s: EventState = "DRAFT";
    const events = [
      "SUBMIT_FOR_VALIDATION",
      "MARK_VALID",
      "SCHEDULE",
      "QUEUE_INVITATIONS",
      "MARK_INVITED",
      "ENTER_REMINDER_WINDOW",
      "QUEUE_CANCELLATION",
      "CANCEL",
      "PROCESS_CALENDAR_CANCELLATION",
      "ARCHIVE",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      s = applyTransition(ordinaryEventMachine, s, events[i]!);
      expect(s).toBe(path[i + 1]);
    }
    expect(ordinaryEventMachine.isTerminal(s)).toBe(true);
  });

  it("rejects an attendance transition (INVITED → ATTENDED is impossible)", () => {
    const result = ordinaryEventMachine.next("INVITED", "ATTEND" as never);
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INVALID_TRANSITION");
  });

  it("handles invitation-send failure: SEND_FAILURE → INVITATIONS_QUEUED via retry", () => {
    let s = applyTransition(ordinaryEventMachine, "INVITATIONS_QUEUED", "RECORD_SEND_FAILURE");
    expect(s).toBe("SEND_FAILURE");
    s = applyTransition(ordinaryEventMachine, s, "RETRY_INVITATIONS");
    expect(s).toBe("INVITATIONS_QUEUED");
  });

  it("handles cancellation failure: CANCELLATION_QUEUED → CANCELLATION_FAILURE → CRITICAL_OPERATOR_ACTION", () => {
    let s = applyTransition(
      ordinaryEventMachine,
      "CANCELLATION_QUEUED",
      "RECORD_CANCELLATION_FAILURE",
    );
    expect(s).toBe("CANCELLATION_FAILURE");
    s = applyTransition(ordinaryEventMachine, s, "ESCALATE_TO_OPERATOR");
    expect(s).toBe("CRITICAL_OPERATOR_ACTION");
    s = applyTransition(ordinaryEventMachine, s, "RECOVER_VIA_OPERATOR");
    expect(s).toBe("CANCELLED");
  });

  it("has no path from any state to ATTENDED, CHECKED_IN, or NO_SHOW", () => {
    // Walk every state and assert that none of the forbidden events are
    // accepted from any reachable state.
    const reachable: ReadonlyArray<typeof ordinaryEventMachine.initial> = [
      "DRAFT",
      "VALIDATING",
      "APPROVED",
      "SCHEDULED",
      "INVITATIONS_QUEUED",
      "INVITED",
      "REMINDER_WINDOW",
      "CANCELLATION_QUEUED",
      "CANCELLATION_FAILURE",
      "CRITICAL_OPERATOR_ACTION",
      "CANCELLED",
      "CALENDAR_CANCELLATION_PROCESSED",
      "SEND_FAILURE",
    ];
    const forbidden = ["ATTEND", "CHECK_IN", "RECORD_NO_SHOW"] as const;
    for (const state of reachable) {
      for (const ev of forbidden) {
        const r = ordinaryEventMachine.next(state, ev as never);
        expect(r.allowed, `${state} should not allow ${ev}`).toBe(false);
      }
    }
  });
});
