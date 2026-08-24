# 18. Locked vs Open Decisions

## Locked

- product premise;
- no ordinary attendance;
- A$5/A$20/A$50 target pricing;
- public name: Plans With You;
- tier names: Member, Corresponding Member, Deluxe Member;
- production visual system and tagline in `src/brand/config.ts`;
- product cadence policy in `src/brand/cadence.ts`;
- waiting-list-first;
- Cloudflare Workers;
- D1;
- R2;
- Queues;
- Cron;
- Wrangler;
- Resend outbound/inbound;
- `club.loftwah.com`;
- `/api/webhooks/resend`;
- `email.received` initially;
- `RESEND_WEBHOOK_ID`;
- `RESEND_WEBHOOK_SIGNING_SECRET`;
- MiniMax initial AI;
- runtime MiniMax permitted;
- ThreeUI;
- GitHub;
- local-first CI;
- API/MCP agents;
- operator tasks via email/admin;
- optional Society alias;
- real cancelled-event counter;
- consent/preferences before paid activation;
- actor service can exist outside premium subscription.

## Open — ask before locking

### Production scheduling

- exact runtime Cron Trigger frequency for ordinary-event discovery and the safety monitor. No production trigger is currently deployed; runtime scheduling must not be inferred from the locked product cadence policy.

### Launch geography

- Melbourne only vs five metros vs broader waitlist.

### Physical economics

- pack contents;
- milestone schedule;
- postage/gift budgets;
- inventory.

### Calls

- exact A$20/A$50 allowances.

### Actor service

- public name;
- prices;
- lead times;
- member discounts;
- radius.

### Billing

- annual prices/discounts;
- downgrade timing;
- refund policy.

### Legal

- final terms/privacy/appearance agreements.

### Admin auth

- Cloudflare Access vs app-native.

### Framework

If repository is empty, recommend the best Workers + React/ThreeUI + SEO architecture and explain the choice. Do not pick only because it is fashionable.

---
