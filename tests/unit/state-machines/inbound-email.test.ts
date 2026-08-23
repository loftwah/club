import { describe, expect, it } from "vitest";
import { applyTransition } from "@domain/state-machine";
import { inboundEmailMachine } from "@domain/machines/inbound-email";

describe("inbound email state machine", () => {
  it("happy path: RECEIVED → CLOSED (matched + auto-handled)", () => {
    let s = applyTransition(inboundEmailMachine, "RECEIVED", "VERIFY_SIGNATURE");
    s = applyTransition(inboundEmailMachine, s, "PERSIST_METADATA");
    s = applyTransition(inboundEmailMachine, s, "FETCH_BODY");
    s = applyTransition(inboundEmailMachine, s, "BODY_FETCHED");
    s = applyTransition(inboundEmailMachine, s, "MATCH_SENDER");
    s = applyTransition(inboundEmailMachine, s, "CLASSIFY");
    s = applyTransition(inboundEmailMachine, s, "AUTO_HANDLE");
    s = applyTransition(inboundEmailMachine, s, "CLOSE");
    expect(s).toBe("CLOSED");
  });

  it("invalid signature → REJECTED (terminal, no business processing)", () => {
    const s = applyTransition(inboundEmailMachine, "RECEIVED", "REJECT_SIGNATURE");
    expect(s).toBe("REJECTED");
    expect(inboundEmailMachine.isTerminal(s)).toBe(true);
  });

  it("duplicate → ACKNOWLEDGED_NOOP (terminal, dedupe no-op)", () => {
    const s = applyTransition(inboundEmailMachine, "RECEIVED", "ACK_DUPLICATE");
    expect(s).toBe("ACKNOWLEDGED_NOOP");
    expect(inboundEmailMachine.isTerminal(s)).toBe(true);
  });

  it("body fetch failure → retry succeeds → CLOSED", () => {
    let s = applyTransition(inboundEmailMachine, "STORED", "FETCH_BODY");
    s = applyTransition(inboundEmailMachine, s, "BODY_FETCH_FAILED");
    s = applyTransition(inboundEmailMachine, s, "RETRY_FETCH");
    s = applyTransition(inboundEmailMachine, s, "BODY_FETCHED");
    s = applyTransition(inboundEmailMachine, s, "MATCH_SENDER");
    s = applyTransition(inboundEmailMachine, s, "CLASSIFY");
    s = applyTransition(inboundEmailMachine, s, "AUTO_HANDLE");
    s = applyTransition(inboundEmailMachine, s, "CLOSE");
    expect(s).toBe("CLOSED");
  });

  it("body fetch failure escalation → PERMANENT_FAILURE (terminal)", () => {
    let s = applyTransition(inboundEmailMachine, "STORED", "FETCH_BODY");
    s = applyTransition(inboundEmailMachine, s, "BODY_FETCH_FAILED");
    s = applyTransition(inboundEmailMachine, s, "ESCALATE_FETCH");
    expect(s).toBe("PERMANENT_FAILURE");
    expect(inboundEmailMachine.isTerminal(s)).toBe(true);
  });
});
