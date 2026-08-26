import type { CSSProperties, ReactNode } from "react";

/**
 * The only states the visual lifecycle can represent.
 *
 * A plan is never an attendance record. Cancellation is deliberate
 * fulfilment; archival is the quiet record that remains afterwards.
 */
export const PLAN_LIFECYCLE_STATES = [
  "invited",
  "planned",
  "approaching",
  "cancelled",
  "archived",
] as const;

export type PlanLifecycleState = (typeof PLAN_LIFECYCLE_STATES)[number];

/** States that must never be accepted as a plan lifecycle state. */
export const FORBIDDEN_PLAN_LIFECYCLE_STATES = [
  "attended",
  "checked_in",
  "no_show",
  "rsvp",
] as const;

export type ForbiddenPlanLifecycleState = (typeof FORBIDDEN_PLAN_LIFECYCLE_STATES)[number];

export interface PlanLifecycleEvent {
  /** Stable server-side identifier, exposed for integration and testing. */
  id: string;
  title: string;
  /** Human-readable date supplied by the caller, e.g. "Saturday 12 September 2026". */
  date: string;
  /** Machine-readable date for the semantic <time> element. */
  dateTime?: string;
  chapter: string;
  status: string;
  location?: string;
  detail?: string;
}

export interface PlanLifecycleProps {
  state: PlanLifecycleState;
  event: PlanLifecycleEvent;
  /** Optional controlled action. The component never changes state by itself. */
  onAdvance?: (nextState: PlanLifecycleState) => void;
  /** Show the adjacent-state action when the host supplies an action handler. */
  showAdvanceControl?: boolean;
  /** Render a deliberately still presentation, useful for static/print contexts. */
  staticMode?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface PlanLifecycleStep {
  state: PlanLifecycleState;
  label: string;
  description: string;
}

export const PLAN_LIFECYCLE_STEPS: readonly PlanLifecycleStep[] = [
  {
    state: "invited",
    label: "Invited",
    description: "The invitation is on its way.",
  },
  {
    state: "planned",
    label: "Planned",
    description: "The plan has a date.",
  },
  {
    state: "approaching",
    label: "Approaching",
    description: "The date is getting closer.",
  },
  {
    state: "cancelled",
    label: "Cancelled",
    description: "The plan is cancelled on purpose. The promise has been kept.",
  },
  {
    state: "archived",
    label: "Archived",
    description: "The invitation and cancellation stay together in your history.",
  },
];

const PLAN_LIFECYCLE_STATE_SET = new Set<string>(PLAN_LIFECYCLE_STATES);
const FORBIDDEN_PLAN_LIFECYCLE_STATE_SET = new Set<string>(FORBIDDEN_PLAN_LIFECYCLE_STATES);

export function isPlanLifecycleState(value: string): value is PlanLifecycleState {
  return PLAN_LIFECYCLE_STATE_SET.has(value);
}

export function isForbiddenPlanLifecycleState(value: string): value is ForbiddenPlanLifecycleState {
  return FORBIDDEN_PLAN_LIFECYCLE_STATE_SET.has(value);
}

export function assertPlanLifecycleState(value: string): asserts value is PlanLifecycleState {
  if (isPlanLifecycleState(value)) return;

  if (isForbiddenPlanLifecycleState(value)) {
    throw new Error(
      `Forbidden plan lifecycle state: ${value}. Plans do not record attendance or RSVP states.`,
    );
  }

  throw new Error(`Unknown plan lifecycle state: ${value}`);
}

/** Return the adjacent visual state, if one exists. */
export function nextPlanLifecycleState(state: PlanLifecycleState): PlanLifecycleState | undefined {
  const index = PLAN_LIFECYCLE_STATES.indexOf(state);
  if (index < 0) return undefined;
  return PLAN_LIFECYCLE_STATES[index + 1];
}

/** Cancellation is a successful fulfilment even before its archive view. */
export function isSuccessfulPlanFulfilment(state: PlanLifecycleState): boolean {
  return state === "cancelled" || state === "archived";
}

export function isArchivedPlan(state: PlanLifecycleState): boolean {
  return state === "archived";
}

function stepFor(state: PlanLifecycleState): PlanLifecycleStep {
  // assertPlanLifecycleState above keeps this lookup total at runtime while
  // retaining a useful, narrow type for callers and tests.
  return PLAN_LIFECYCLE_STEPS[PLAN_LIFECYCLE_STATES.indexOf(state)]!;
}

function joinClassNames(...names: Array<string | undefined | false>): string {
  return names.filter(Boolean).join(" ");
}

export default function PlanLifecycle({
  state,
  event,
  onAdvance,
  showAdvanceControl = false,
  staticMode = false,
  className,
  children,
}: PlanLifecycleProps) {
  assertPlanLifecycleState(state);

  const currentIndex = PLAN_LIFECYCLE_STATES.indexOf(state);
  const currentStep = stepFor(state);
  const nextState = nextPlanLifecycleState(state);
  const progressPercent = `${(currentIndex / (PLAN_LIFECYCLE_STATES.length - 1)) * 100}%`;
  const shouldShowAdvance =
    showAdvanceControl && Boolean(onAdvance) && Boolean(nextState) && !staticMode;

  return (
    <section
      className={joinClassNames("plan-lifecycle", className)}
      data-plan-id={event.id}
      data-state={state}
      data-static={staticMode ? "true" : "false"}
      style={{ "--plan-lifecycle-progress": progressPercent } as CSSProperties}
      aria-labelledby={`plan-lifecycle-title-${event.id}`}
    >
      <div className="plan-lifecycle__wash" aria-hidden="true" />

      <header className="plan-lifecycle__header">
        <div className="plan-lifecycle__heading">
          <p className="plan-lifecycle__kicker">What happens</p>
          <h2 id={`plan-lifecycle-title-${event.id}`} className="plan-lifecycle__title">
            {event.title}
          </h2>
          {event.detail ? <p className="plan-lifecycle__detail">{event.detail}</p> : null}
        </div>

        <p className="plan-lifecycle__current" aria-live="polite">
          <span className="plan-lifecycle__current-label">Current state</span>
          <strong>{currentStep.label}</strong>
        </p>
      </header>

      <dl className="plan-lifecycle__facts" aria-label="Plan details">
        <div className="plan-lifecycle__fact">
          <dt>Date</dt>
          <dd>
            <time dateTime={event.dateTime}>{event.date}</time>
          </dd>
        </div>
        <div className="plan-lifecycle__fact">
          <dt>Chapter</dt>
          <dd>{event.chapter}</dd>
        </div>
        <div className="plan-lifecycle__fact">
          <dt>Status</dt>
          <dd>{event.status}</dd>
        </div>
        {event.location ? (
          <div className="plan-lifecycle__fact">
            <dt>Place</dt>
            <dd>{event.location}</dd>
          </div>
        ) : null}
      </dl>

      <div className="plan-lifecycle__timeline-wrap">
        <p className="plan-lifecycle__timeline-label">The sequence</p>
        <ol className="plan-lifecycle__timeline" aria-label="Plan sequence">
          {PLAN_LIFECYCLE_STEPS.map((step, index) => {
            const isCurrent = step.state === state;
            const isComplete = index <= currentIndex;

            return (
              <li
                className={joinClassNames(
                  "plan-lifecycle__step",
                  isCurrent && "plan-lifecycle__step--current",
                  isComplete && "plan-lifecycle__step--complete",
                )}
                data-step={step.state}
                data-complete={isComplete ? "true" : "false"}
                aria-current={isCurrent ? "step" : undefined}
                key={step.state}
              >
                <span className="plan-lifecycle__marker" aria-hidden="true">
                  <span />
                </span>
                <span className="plan-lifecycle__step-copy">
                  <span className="plan-lifecycle__step-label">
                    {step.label}
                    {isCurrent ? (
                      <span className="plan-lifecycle__step-current">Current</span>
                    ) : null}
                  </span>
                  <span className="plan-lifecycle__step-description">{step.description}</span>
                </span>
                {isCurrent ? <span className="sr-only">Current state</span> : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="plan-lifecycle__footer">
        <p className="plan-lifecycle__message">{currentStep.description}</p>
        {children}
        {shouldShowAdvance && nextState ? (
          <button
            className="plan-lifecycle__advance"
            type="button"
            onClick={() => onAdvance?.(nextState)}
          >
            Continue to {stepFor(nextState).label}
          </button>
        ) : null}
      </div>
    </section>
  );
}
