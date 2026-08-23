# 11. Human Operator Runtime

## 11.1 Task types

```text
PRINT_AND_SIGN
POST_ITEM
SELECT_GIFT
PURCHASE_GIFT
MAKE_CALL
REVIEW_CORRESPONDENCE
REVIEW_INBOUND_MESSAGE
APPROVE_EVENT
RESEARCH_EXCEPTION
APPEARANCE_ENQUIRY
PERFORM_APPEARANCE
PRIVACY_REQUEST
CRITICAL_CANCELLATION
```

## 11.2 Admin landing page

Primary question:

> **What does the Society need from me?**

Example:

```text
TODAY
3 letters to sign
1 birthday call
2 gifts awaiting selection
1 appearance enquiry
4 inbound messages requiring review

SYSTEM
0 dangerous uncancelled events
1 retried email
0 overdue fulfilments
```

## 11.3 Operator email

Every task email includes:

- task;
- member/event;
- deadline;
- relevant permitted context;
- exact action;
- attachment/link;
- completion action;
- consequence if missed where relevant.

## 11.4 Call briefing

Example:

```text
Member: Alex
Purpose: birthday
Allowed window: 16:00–18:00 local
Member since: 2027
Relevant: Frank the dog, pottery
Do not mention: previous employer
```

## 11.5 Multiple operators later

Initial `OPERATOR_EMAIL` can target one person, but domain design should permit assignment to multiple operators later.

---
