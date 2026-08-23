# 10. AI, MiniMax, API and MCP

## 10.1 Two AI planes

### Runtime AI

Bounded calls from deterministic workflows:

- event copy;
- cancellation copy;
- letters;
- birthday copy;
- image generation;
- inbound classification;
- candidate fact extraction.

### Autonomous agent AI

Local/hosted larger work:

- chapter research;
- location curation;
- operations review;
- monthly event preparation;
- content/SEO work;
- repository development.

## 10.2 MiniMax

Initial provider for text/images and agent work where suitable.

`MINIMAX_API_KEY` exists in project environment.

Provider abstraction is mandatory because MiniMax model names and capabilities evolve.

## 10.3 Runtime pattern

```text
deterministic system decides WHAT is required
→ AI generates/suggests HOW it should read/look
→ validator
→ domain action
```

Not:

```text
AI wakes up and invents business state
```

## 10.4 Safe MCP capabilities

### Member reads

```text
club.get_member_context
club.get_member_preferences
club.get_member_timeline
club.get_member_service_grants
```

### Operations

```text
club.get_daily_operations
club.list_due_milestones
club.list_operator_tasks
club.get_system_health
```

### Events

```text
club.propose_event
club.validate_event
club.schedule_event
club.cancel_event
```

### Correspondence

```text
club.draft_correspondence
club.validate_correspondence
club.queue_correspondence
```

### Memory

```text
club.propose_member_fact
club.list_member_fact_candidates
```

### Geography

```text
club.list_locations
club.propose_location_candidate
```

### Human tasks

```text
club.create_operator_task
```

## 10.5 Do not expose

```text
execute_arbitrary_sql
dump_all_members
write_unvalidated_member_record
send_unvalidated_email
```

## 10.6 Capability levels

- read;
- draft/proposal;
- operational write;
- restricted.

Restricted actions include refunds, deletion, expensive purchases, sensitive facts and appearance approval.

## 10.7 AI output schemas

Use structured outputs where logic depends on result.

Example correspondence:

```text
subject
preview
body
memberFactIdsUsed[]
claims[]
```

## 10.8 Validation

Reject output if:

- invented member fact;
- do-not-mention;
- fake partnership;
- wrong member/event;
- unsupported location;
- attendance instruction;
- malformed schema;
- unsafe request.

## 10.9 Prompt/version provenance

Record:

- prompt ID/version;
- provider/model;
- generation ID;
- fact IDs;
- validation result;
- final action.

## 10.10 Context minimisation

Give models only task-relevant member data. Never broad unrelated member access.

## 10.11 Prompt injection

Member-provided text is data. Tools and scoped context prevent cross-member access.

## 10.12 AI outage

Critical cancellation degrades to deterministic safe content. AI outage must not leave events active.

## 10.13 Current MiniMax references

- https://www.minimax.io/models/text
- https://platform.minimax.io/docs/api-reference/api-overview
- https://platform.minimax.io/docs/guides/text-generation

---
