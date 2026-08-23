# 7. State Machines

## 7.1 Waitlist

```mermaid
stateDiagram-v2
    [*] --> Submitted
    Submitted --> Validated
    Submitted --> Rejected
    Validated --> WelcomeQueued
    WelcomeQueued --> ActiveWaitlist: delivered
    WelcomeQueued --> Retry: transient failure
    WelcomeQueued --> InvalidEmail: hard bounce
    Retry --> ActiveWaitlist: delivered
    Retry --> FailedPermanently: exhausted
    ActiveWaitlist --> Converted
    ActiveWaitlist --> Unsubscribed
    ActiveWaitlist --> Deleted
    Rejected --> [*]
    InvalidEmail --> [*]
    FailedPermanently --> [*]
    Converted --> [*]
    Unsubscribed --> [*]
    Deleted --> [*]
```

## 7.2 Paid onboarding

```mermaid
stateDiagram-v2
    [*] --> Applicant
    Applicant --> EmailVerified
    Applicant --> Abandoned
    EmailVerified --> IdentityComplete
    IdentityComplete --> ChapterResolution
    ChapterResolution --> WaitlistOnly: unsupported
    ChapterResolution --> TierSelected: supported
    TierSelected --> PreferencesComplete
    PreferencesComplete --> ServicesSelected
    ServicesSelected --> AlignmentComplete
    AlignmentComplete --> ConsentsComplete
    ConsentsComplete --> TermsAccepted
    TermsAccepted --> PaymentPending
    PaymentPending --> Active: authoritative billing success
    PaymentPending --> NotActivated: cancelled/abandoned
    Active --> [*]
    WaitlistOnly --> [*]
    Abandoned --> [*]
    NotActivated --> [*]
```

## 7.3 Membership standing

```text
ACTIVE
→ PAST_DUE → ACTIVE | CANCELLED
ACTIVE → CANCELLED
CANCELLED → ACTIVE on rejoin
ACTIVE → SUSPENDED → ACTIVE
```

Deletion is separate.

## 7.4 Ordinary event

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Validating
    Validating --> Draft: fixable
    Validating --> Abandoned: unusable
    Validating --> Approved: valid
    Approved --> Scheduled
    Scheduled --> InvitationsQueued
    InvitationsQueued --> Invited
    InvitationsQueued --> SendFailure
    SendFailure --> InvitationsQueued: retry
    SendFailure --> OperatorReview: exhausted
    Invited --> ReminderWindow
    ReminderWindow --> CancellationQueued
    CancellationQueued --> Cancelled
    CancellationQueued --> CancellationFailure
    CancellationFailure --> CancellationQueued: priority retry
    CancellationFailure --> CriticalOperatorAction: deadline risk
    CriticalOperatorAction --> Cancelled: recovery
    Cancelled --> CalendarCancellationProcessed
    CalendarCancellationProcessed --> Archived
    Abandoned --> [*]
    Archived --> [*]
```

Forbidden ordinary-event states:

```text
ATTENDED
CHECKED_IN
NO_SHOW
```

## 7.5 Communication

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Generated
    Generated --> Validated
    Generated --> Rejected
    Validated --> Scheduled
    Scheduled --> CancelledBeforeSend
    Scheduled --> Queued
    Queued --> Sent
    Queued --> TransientFailure
    TransientFailure --> Queued: retry
    TransientFailure --> PermanentFailure: exhausted
    Sent --> Delivered
    Sent --> Bounced
    Sent --> Complained
    Rejected --> [*]
    CancelledBeforeSend --> [*]
    PermanentFailure --> [*]
    Delivered --> [*]
    Bounced --> [*]
    Complained --> [*]
```

## 7.6 Inbound email

```text
RECEIVED
→ SIGNATURE_VERIFIED
→ STORED
→ MATCHED | UNMATCHED
→ CLASSIFIED
→ AUTO_HANDLED | HUMAN_REVIEW | SAFE_NO_ACTION
→ CLOSED
```

Failures:

```text
INVALID_SIGNATURE → REJECTED
DUPLICATE → ACKNOWLEDGED_NOOP
MALFORMED → QUARANTINED/REJECTED
PROCESSING_FAILURE → RETRY → HUMAN_REVIEW/PERMANENT_FAILURE
```

## 7.7 Human fulfilment

```mermaid
stateDiagram-v2
    [*] --> Created
    Created --> OperatorNotified
    OperatorNotified --> Acknowledged
    Acknowledged --> InProgress
    InProgress --> Completed
    Created --> Cancelled
    OperatorNotified --> Overdue
    Acknowledged --> Rescheduled
    InProgress --> Blocked
    Overdue --> Escalated
    Escalated --> InProgress
    Blocked --> InProgress
    Blocked --> Cancelled
    Rescheduled --> OperatorNotified
    Completed --> [*]
    Cancelled --> [*]
```

## 7.8 Gift

```text
TRIGGERED
→ ELIGIBILITY_CHECK
  → NOT_ELIGIBLE → CLOSED
  → MEMBER_OPTED_OUT → CLOSED
  → BUDGET_DENIED → ALTERNATIVE/CLOSED
  → ELIGIBLE
→ SUGGESTED
→ HUMAN_APPROVED
→ PURCHASED
→ DISPATCHED
→ DELIVERED
```

Exceptions terminate through retry, alternative, replacement or closure.

## 7.9 Call

```text
PROPOSED
→ POLICY_ALLOWED | DENIED
→ SCHEDULED
→ DUE
→ COMPLETED
```

Branches:

```text
PERMISSION_REVOKED → CANCELLED
MEMBER_CANCELLED → CANCELLED
NO_ANSWER → RESCHEDULED/CLOSED according to policy
```

## 7.10 Manufactured commitment

```mermaid
stateDiagram-v2
    [*] --> Requested
    Requested --> GoalCaptured
    GoalCaptured --> ScenarioProposed
    ScenarioProposed --> Confirmed
    ScenarioProposed --> Declined
    Confirmed --> Scheduled
    Scheduled --> ReminderPhase
    ReminderPhase --> PressureWindow
    PressureWindow --> CancellationQueued
    CancellationQueued --> Completed
    CancellationQueued --> OperatorEscalation: failure
    OperatorEscalation --> Completed
    Requested --> Aborted
    GoalCaptured --> Aborted
    ScenarioProposed --> Aborted
    Confirmed --> Aborted
    Scheduled --> Aborted
    ReminderPhase --> Aborted
    PressureWindow --> Aborted
    OperatorEscalation --> Aborted
    Completed --> [*]
    Aborted --> [*]
    Declined --> [*]
```

## 7.11 Appearance service

```mermaid
stateDiagram-v2
    [*] --> Requested
    Requested --> Declined
    Requested --> SuitabilityApproved
    SuitabilityApproved --> Quoted
    Quoted --> QuoteExpired
    Quoted --> Accepted
    Accepted --> PaymentPending
    PaymentPending --> Booked
    PaymentPending --> PaymentFailed
    Booked --> Performed
    Booked --> CustomerCancelled
    Booked --> ClubCancelled
    Booked --> SafetyCancelled
    CustomerCancelled --> RefundResolution
    ClubCancelled --> RefundResolution
    SafetyCancelled --> RefundResolution
    Performed --> Closed
    RefundResolution --> Closed
    Declined --> [*]
    QuoteExpired --> [*]
    PaymentFailed --> [*]
    Closed --> [*]
```

## 7.12 Deletion

```text
REQUESTED
→ ACTIVITY_SUSPENDED
→ FUTURE_JOBS_CANCELLED
→ PERSONAL_DATA_DELETION
→ REQUIRED_RETENTION_SEPARATED
→ DELETED
```

## 7.13 State-machine test rule

Every state must have a documented outgoing path unless terminal. Every failure must retry, close or escalate. Invalid transitions are tested.

---
