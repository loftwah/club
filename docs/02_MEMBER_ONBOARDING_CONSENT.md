# 3. Member Onboarding, Alignment, Preferences and Consent

## 3.1 Paid activation rule

Conceptually:

```text
ACTIVE =
  identity_complete
  AND chapter_resolved
  AND tier_selected
  AND preferences_complete
  AND services_selected
  AND alignment_acknowledged
  AND required_consents_current
  AND required_terms_current
  AND billing_active
```

Waiting-list release has a separate waitlist state and does not create fake paid active membership.

## 3.2 Identity

Required initially:

- email;
- first name/preferred first name;
- country;
- metro/chapter area.

Optional:

- surname;
- preferred/correspondence name;
- Society alias/codename;
- birthday;
- postal address where services require it.

## 3.3 Why are you joining?

Multi-select alignment form can include:

- I enjoy having plans cancelled.
- I want to feel included without attendance pressure.
- I want proper correspondence.
- I want the Society to remember me.
- I want physical mail.
- I want occasional human contact.
- I want accountability/manufactured commitments.
- I like gifts and surprises.
- I may use a Society representative service.
- I mostly think this is funny.

Optional free text.

## 3.4 Ordinary event preferences

### Frequency

Candidate presets, exact policy not yet final:

- occasional;
- approximately monthly;
- a couple per month;
- Society discretion.

### Types

- dinners;
- gallery/museum;
- theatre;
- music;
- walks;
- talks;
- formal;
- casual;
- cultural;
- unusual Society function;
- surprise me.

### Timing

- weekdays;
- Friday;
- weekends;
- daytime;
- evening;
- broad.

### Geography

- chapter;
- preferred areas;
- areas to avoid;
- plausible fictional travel radius.

### Cancellation personality

Candidate modes:

- Merciful;
- Traditional;
- Last Minute;
- Society discretion.

Exact time windows require user approval.

## 3.5 Communication preferences

Model independently:

```text
EMAIL_OPERATIONAL
NEWSLETTER
PERSONAL_EMAIL
CALENDAR_MESSAGES
POSTAL_CORRESPONDENCE
BIRTHDAY_POST
CALLS
GIFTS
SURPRISE_GIFTS
```

Newsletter opt-out must not block essential operational cancellation email.

## 3.6 Member memory

Explain clearly that the Society can remember information the member chooses to provide so future correspondence has continuity.

Possible categories:

- hobbies;
- interests;
- pets;
- projects;
- voluntarily supplied work milestones;
- favourite things;
- voluntarily supplied family details;
- important dates;
- running jokes;
- previous gifts;
- correspondence context.

Provide:

- **Things the Society should know about me**
- **Things the Society should never mention**

## 3.7 Physical correspondence

States:

```text
INELIGIBLE
AVAILABLE
OPTED_IN
WAIVED_BY_MEMBER
PAUSED
```

If opted in, capture:

- postal address;
- postal name;
- cards allowed;
- letters allowed;
- packages allowed;
- surprise packages allowed.

A member can waive physical fulfilment without blocking core membership.

## 3.8 Gifts

Where available:

- enabled/disabled;
- surprises enabled/disabled;
- ask first;
- club artefacts only;
- exclusions;
- interests;
- never-send notes.

## 3.9 Calls

Explicit opt-in only.

Possible modes:

```text
NO_CALLS
BIRTHDAY_CALLS
MILESTONE_CALLS
OCCASIONAL_CLUB_CALLS
ALL_ALLOWED
```

Also store:

- preferred days;
- time windows;
- timezone;
- voicemail permission;
- surprise call permission;
- contact-first preference.

Tier entitlement never overrides member opt-out.

## 3.10 Manufactured commitments

Membership-level opt-in only means the service may be offered.

Every actual scenario requires separate confirmation.

The member acknowledges:

- scenario is constructed;
- fictional names may be used;
- nobody is really travelling unless separately booked;
- member can abort;
- Society will explicitly terminate scenario.

## 3.11 Appearance-service interest

Onboarding may record:

```text
INTERESTED
NOT_INTERESTED
ASK_LATER
```

This is not a booking or blanket agreement.

## 3.12 Plain-language expectations gate

Before paid activation, state clearly:

- ordinary Society events are constructed;
- ordinary Society events are intended to be cancelled;
- members are not expected to attend;
- Society characters/attendees may be fictional;
- real locations do not imply partnership;
- AI/automation may assist authorised personalisation;
- human operators perform selected real-world tasks;
- optional services remain controllable.

Require explicit acknowledgement.

## 3.13 Versioned legal documents

Do not store merely `terms_accepted=true`.

Suggested types:

```text
MEMBERSHIP_TERMS
PRIVACY_POLICY
THEATRICAL_EXPERIENCE_ACKNOWLEDGEMENT
PERSONALISATION_CONSENT
PHYSICAL_FULFILMENT_CONSENT
CALL_CONSENT
MANUFACTURED_COMMITMENT_TERMS
APPEARANCE_SERVICE_TERMS
```

Store exact document version, effective date, content hash, acceptance time and method.

## 3.14 Reconsent

A material optional-service terms change should normally pause only that service.

Example:

```text
CORE_MEMBERSHIP = ACTIVE
CALLS = PAUSED_PENDING_RECONSENT
```

## 3.15 Permission revocation

Revocation affects future scheduled work.

Example:

```text
birthday call already scheduled
→ member disables calls
→ future call task cancelled
→ audit reason MEMBER_OPTED_OUT
→ other birthday actions continue
```

---
