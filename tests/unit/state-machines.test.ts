import { describe, expect, it } from "vitest";
import { defineMachine, applyTransition } from "@domain/state-machine";
import { commitmentMachine } from "@domain/machines/manufactured-commitment";
import { fulfilmentMachine } from "@domain/machines/fulfilment";
import { communicationMachine } from "@domain/machines/communication";

describe("manufactured commitment state machine", () => {
  it("happy path: REQUESTED → COMPLETED", () => {
    let s = applyTransition(commitmentMachine, "REQUESTED", "CAPTURE_GOAL");
    s = applyTransition(commitmentMachine, s, "PROPOSE_SCENARIO");
    s = applyTransition(commitmentMachine, s, "CONFIRM");
    s = applyTransition(commitmentMachine, s, "SCHEDULE");
    s = applyTransition(commitmentMachine, s, "ENTER_REMINDER_PHASE");
    s = applyTransition(commitmentMachine, s, "ENTER_PRESSURE_WINDOW");
    s = applyTransition(commitmentMachine, s, "QUEUE_CANCELLATION");
    s = applyTransition(commitmentMachine, s, "CANCEL");
    expect(s).toBe("COMPLETED");
  });

  it("abort is allowed from any pre-completion state", () => {
    const states = [
      "REQUESTED",
      "GOAL_CAPTURED",
      "SCENARIO_PROPOSED",
      "CONFIRMED",
      "SCHEDULED",
      "REMINDER_PHASE",
      "PRESSURE_WINDOW",
      "OPERATOR_ESCALATION",
    ] as const;
    for (const start of states) {
      const s = applyTransition(commitmentMachine, start, "ABORT");
      expect(s, `ABORT from ${start}`).toBe("ABORTED");
    }
  });

  it("cancellation failure escalates to operator, then recovers", () => {
    let s = applyTransition(commitmentMachine, "CANCELLATION_QUEUED", "ESCALATE");
    expect(s).toBe("OPERATOR_ESCALATION");
    s = applyTransition(commitmentMachine, s, "RECOVER");
    expect(s).toBe("COMPLETED");
  });
});

describe("fulfilment state machine", () => {
  it("CREATED → COMPLETED with notify/ack/start/complete", () => {
    let s = applyTransition(fulfilmentMachine, "CREATED", "NOTIFY_OPERATOR");
    s = applyTransition(fulfilmentMachine, s, "ACKNOWLEDGE");
    s = applyTransition(fulfilmentMachine, s, "START");
    s = applyTransition(fulfilmentMachine, s, "COMPLETE");
    expect(s).toBe("COMPLETED");
  });

  it("overdue → escalated → back in progress", () => {
    let s = applyTransition(fulfilmentMachine, "OPERATOR_NOTIFIED", "BECOME_OVERDUE");
    expect(s).toBe("OVERDUE");
    s = applyTransition(fulfilmentMachine, s, "ESCALATE");
    expect(s).toBe("ESCALATED");
    s = applyTransition(fulfilmentMachine, s, "START");
    expect(s).toBe("IN_PROGRESS");
  });
});

describe("communication state machine", () => {
  it("happy path: DRAFT → DELIVERED", () => {
    let s = applyTransition(communicationMachine, "DRAFT", "GENERATE");
    s = applyTransition(communicationMachine, s, "VALIDATE");
    s = applyTransition(communicationMachine, s, "SCHEDULE");
    s = applyTransition(communicationMachine, s, "QUEUE");
    s = applyTransition(communicationMachine, s, "SENT");
    s = applyTransition(communicationMachine, s, "DELIVER");
    expect(s).toBe("DELIVERED");
  });

  it("transient failure retries to QUEUED", () => {
    let s = applyTransition(communicationMachine, "QUEUED", "RECORD_TRANSIENT_FAILURE");
    s = applyTransition(communicationMachine, s, "RETRY");
    expect(s).toBe("QUEUED");
  });

  it("retry exhaustion → PERMANENT_FAILURE (terminal)", () => {
    const s = applyTransition(communicationMachine, "TRANSIENT_FAILURE", "EXHAUST_RETRIES");
    expect(s).toBe("PERMANENT_FAILURE");
  });
});

describe("state machine primitive", () => {
  it("defineMachine returns a valid machine with terminal check", () => {
    const m = defineMachine({
      initial: "A",
      transitions: [
        { from: "A", event: "GO", to: "B" },
        { from: "B", event: "GO", to: "C" },
      ],
      isTerminal: (s) => s === "C",
    });
    expect(m.initial).toBe("A");
    expect(m.isTerminal("A")).toBe(false);
    expect(m.isTerminal("C")).toBe(true);
    expect(m.next("A", "GO").toState).toBe("B");
    expect(m.next("A", "BAD" as never).allowed).toBe(false);
  });

  it("applyTransition throws on invalid transition", () => {
    const m = defineMachine({
      initial: "A",
      transitions: [{ from: "A", event: "GO", to: "B" }],
    });
    expect(() => applyTransition(m, "B", "GO")).toThrow();
  });
});
