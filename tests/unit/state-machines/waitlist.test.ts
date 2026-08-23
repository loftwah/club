import { describe, expect, it } from "vitest";
import { applyTransition } from "@domain/state-machine";
import { waitlistMachine } from "@domain/machines/waitlist";

describe("waitlist state machine", () => {
  it("happy path: SUBMITTED → ACTIVE_WAITLIST", () => {
    let s = applyTransition(waitlistMachine, "SUBMITTED", "VALIDATE");
    expect(s).toBe("VALIDATED");
    s = applyTransition(waitlistMachine, s, "QUEUE_WELCOME");
    expect(s).toBe("WELCOME_QUEUED");
    s = applyTransition(waitlistMachine, s, "DELIVER");
    expect(s).toBe("ACTIVE_WAITLIST");
  });

  it("transient failure path: WELCOME_QUEUED → RETRY → ACTIVE_WAITLIST", () => {
    let s = applyTransition(waitlistMachine, "WELCOME_QUEUED", "RECORD_TRANSIENT_FAILURE");
    expect(s).toBe("RETRY");
    s = applyTransition(waitlistMachine, s, "DELIVER");
    expect(s).toBe("ACTIVE_WAITLIST");
  });

  it("retry exhaustion: RETRY → FAILED_PERMANENTLY (terminal)", () => {
    const s = applyTransition(waitlistMachine, "RETRY", "EXHAUST_RETRIES");
    expect(s).toBe("FAILED_PERMANENTLY");
    expect(waitlistMachine.isTerminal(s)).toBe(true);
  });

  it("hard bounce: WELCOME_QUEUED → INVALID_EMAIL (terminal)", () => {
    const s = applyTransition(waitlistMachine, "WELCOME_QUEUED", "RECORD_HARD_BOUNCE");
    expect(s).toBe("INVALID_EMAIL");
    expect(waitlistMachine.isTerminal(s)).toBe(true);
  });

  it("reject on submit", () => {
    const s = applyTransition(waitlistMachine, "SUBMITTED", "REJECT");
    expect(s).toBe("REJECTED");
    expect(waitlistMachine.isTerminal(s)).toBe(true);
  });
});
