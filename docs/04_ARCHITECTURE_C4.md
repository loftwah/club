# 5. System Architecture — C4

## 5.1 Architectural rule

> Humans and AI are actors. Cloudflare is the system of record. APIs define capabilities. MCP exposes selected capabilities safely to agents. Queues represent durable work. Cron represents time. Resend represents correspondence. No actor is trusted to remember state that belongs to the system.

## 5.2 C4 Level 1 — System Context

```mermaid
flowchart LR
    Member["Customer / Member"]
    Operator["Human Operator"]
    Agent["AI / Agent Runtime\nLocal or Hosted"]
    Club["Social Club Platform\nCloudflare"]
    Resend["Resend"]
    MiniMax["MiniMax / AI Providers"]
    Stripe["Stripe\nLater"]
    Physical["Physical World\nPost / Gifts / Calls / Travel"]
    GitHub["GitHub\nSource / PR / History"]

    Member <--> Club
    Operator <--> Club
    Agent <--> Club
    Club <--> Resend
    Club <--> MiniMax
    Club <--> Stripe
    Operator <--> Physical
    Agent <--> GitHub
    Operator <--> GitHub
```

## 5.3 C4 Level 2 — Containers

```mermaid
flowchart TB
    subgraph Cloudflare["Cloudflare"]
        App["Workers Application\nPublic + Member + Admin + API + Webhooks"]
        DB["D1\nRelational source of truth"]
        Assets["R2\nArtefacts"]
        Jobs["Queues\nDurable async work"]
        Clock["Cron\nScheduled discovery"]
    end

    Member --> App
    Operator --> App
    Agent --> MCP["API/MCP Capability Surface"]
    MCP --> App

    App <--> DB
    App <--> Assets
    App --> Jobs
    Jobs --> App
    Clock --> App

    App <--> ResendAdapter["Resend Adapter"]
    App <--> AIAdapter["AI Provider Adapter"]
    App <--> BillingAdapter["Stripe Adapter\nLater"]
```

## 5.4 Modular monolith

Start with one coherent deployable Workers application exposing fetch/web routes, API/MCP, webhooks, queue consumer and scheduled handler where supported by chosen framework/entry architecture.

Do not start with a swarm of microservices.

## 5.5 C4 Level 3 — Logical Components

```mermaid
flowchart LR
    Web["Web/UI"]
    API["API + MCP"]
    Auth["Auth/AuthZ"]
    Onboarding["Onboarding"]
    Membership["Membership"]
    Policy["Policy & Entitlements"]
    Consent["Consent & Preferences"]
    Memory["Member Memory"]
    Chapters["Chapters & Locations"]
    Events["Events"]
    Calendar["Calendar"]
    Comms["Correspondence"]
    Inbound["Inbound Email"]
    Milestones["Milestones"]
    Fulfil["Human Fulfilment"]
    Gifts["Gifts"]
    Calls["Calls"]
    Commit["Manufactured Commitments"]
    Appearance["Appearance Service"]
    Billing["Billing"]
    AI["AI Orchestration"]
    Audit["Audit"]
    Persistence["D1 / R2 / Queue"]

    Web --> API
    API --> Auth
    API --> Onboarding
    API --> Membership
    API --> Consent
    API --> Memory
    API --> Chapters
    API --> Events
    API --> Comms
    API --> Commit
    API --> Appearance

    Onboarding --> Policy
    Events --> Policy
    Comms --> Policy
    Milestones --> Policy
    Fulfil --> Policy
    Gifts --> Policy
    Calls --> Policy
    Commit --> Policy
    Appearance --> Policy

    Events --> Calendar
    Milestones --> Fulfil
    Milestones --> Gifts
    Milestones --> Calls
    AI --> API
    API --> Audit
    API --> Persistence
```

## 5.6 Worker responsibilities

- public site;
- waiting list;
- member portal;
- admin;
- API/MCP;
- Resend webhook;
- Stripe webhook later;
- queue handlers;
- scheduled handler;
- protected artefact delivery.

## 5.7 D1

Canonical relational source of business truth.

## 5.8 R2

Stores:

- images;
- letters;
- PDFs;
- cards;
- certificates;
- public brand assets;
- private member artefacts.

Private artefacts require authorised access, not permanent world-readable URLs.

## 5.9 Queues

Logical jobs:

```text
GENERATE_TEXT
GENERATE_IMAGE
RENDER_ARTIFACT
SEND_EMAIL
PROCESS_INBOUND_EMAIL
CREATE_MILESTONE_ACTIONS
CREATE_HUMAN_TASK
RESEARCH_LOCATION
EVENT_HEALTH_CHECK
AI_AGENT_WORK
```

All side-effecting jobs need idempotency.

## 5.10 Cron

Cron discovers due work and enqueues bounded jobs. It does not synchronously perform huge AI/email batches.

## 5.11 Environment model

Do not add `APP_ENV`.

Local, preview and production differ through real URLs, bindings, credentials and provider modes.

## 5.12 Local development

Cloudflare current documentation supports local Worker execution via `workerd`/Miniflare and local simulations for D1, R2 and Queues. Use them for integration/acceptance tests.

## 5.13 Public canonical URL

`https://club.loftwah.com`

Needed for generated absolute links from queues/Cron that have no incoming HTTP origin.

## 5.14 GitHub role

Source, specification, issues, PRs, history, release tags and minimal independent verification. Not part of customer runtime.

---
