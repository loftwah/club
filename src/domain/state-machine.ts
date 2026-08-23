// State machine primitive.
//
// Every important workflow in this product is modelled as an explicit state
// machine. The state machine here is a typed, in-memory checker that decides
// whether a transition is allowed, and produces a TransitionResult the
// caller can persist.
//
// This is the primitive used by the higher-level domain machines in
// src/domain/machines/**. It is not a database thing; it is a pure function.
//
// State machines in this project follow three rules:
//   1. Every state has a documented outgoing path unless it is terminal.
//   2. Every failure has retry, close or escalate.
//   3. Invalid transitions are tested.
//
// See MASTER_SPEC §6 and §7 (state machines). See docs/06_STATE_MACHINES.md.

export type State = string;
export type ReasonCode = string;

export interface Transition<S extends State, E extends string> {
  readonly from: S;
  readonly event: E;
  readonly to: S;
  readonly reasonCode?: ReasonCode;
}

export interface TransitionResult<S extends State> {
  readonly allowed: boolean;
  readonly fromState: S | null;
  readonly toState: S;
  readonly reasonCode: ReasonCode;
}

export type TerminalCheck<S extends State> = (state: S) => boolean;

export class StateMachineError extends Error {
  constructor(
    public readonly fromState: State,
    public readonly event: string,
    public readonly reason: string,
  ) {
    super(`Invalid transition from ${fromState} on event ${event}: ${reason}`);
    this.name = "StateMachineError";
  }
}

/**
 * Build a state machine definition. Transitions are a closed set; an attempt
 * to fire an unknown event, or fire a known event from a non-source state,
 * returns `{ allowed: false }` rather than throwing. The caller decides
 * what to do with the rejection.
 */
export function defineMachine<S extends State, E extends string>(config: {
  initial: S;
  transitions: ReadonlyArray<Transition<S, E>>;
  isTerminal?: TerminalCheck<S>;
}) {
  const { initial, transitions, isTerminal } = config;

  const byFromEvent = new Map<string, Transition<S, E>>();
  for (const t of transitions) {
    byFromEvent.set(`${t.from}::${t.event}`, t);
  }

  function next(from: S | null, event: E): TransitionResult<S> {
    const key = `${from ?? "__initial__"}::${event}`;
    const t = byFromEvent.get(key);
    if (!t) {
      return {
        allowed: false,
        fromState: from,
        toState: from ?? (initial as S),
        reasonCode: "INVALID_TRANSITION",
      };
    }
    return {
      allowed: true,
      fromState: from,
      toState: t.to,
      reasonCode: t.reasonCode ?? "OK",
    };
  }

  function isTerminalState(state: S): boolean {
    return isTerminal ? isTerminal(state) : false;
  }

  return {
    initial,
    next,
    isTerminal: isTerminalState,
  } as const;
}

/**
 * Apply a state transition to a state, or throw. Use this when the caller
 * has already verified the transition is allowed (e.g. inside a service
 * guarded by a policy check). Use `next()` directly when the caller wants
 * to handle rejection.
 */
export function applyTransition<S extends State, E extends string>(
  machine: ReturnType<typeof defineMachine<S, E>>,
  current: S,
  event: E,
): S {
  const result = machine.next(current, event);
  if (!result.allowed) {
    throw new StateMachineError(
      current,
      event,
      result.reasonCode === "INVALID_TRANSITION" ? "no matching transition" : result.reasonCode,
    );
  }
  return result.toState;
}
