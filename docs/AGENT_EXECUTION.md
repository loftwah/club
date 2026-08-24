# Agent execution model

This file expands the mandatory rules in `AGENTS.md` without making every agent
pay their full context cost. `AGENTS.md` remains authoritative when the two
conflict.

## Default operating loop

Work in coherent product-sized batches:

```text
understand → implement → integrate → validate the batch → fix clustered findings
```

Run a focused check early only when a foundational error would multiply rework:
typecheck after a shared API or dependency change, one representative render
while establishing a visual primitive, or a focused auth test after changing a
security boundary. Reserve canonical acceptance and the complete browser/media
matrix for integration boundaries and final judgement.

## Decision authority

Normal engineering, design, copy-detail, performance, and implementation
choices are delegated. Continue through obvious actionable work. Escalate only
the true gates listed in `AGENTS.md`, or when evidence presents materially
different product directions that cannot safely be reconciled.

Do not reopen the public name, tier names, displayed pricing, brand system, or
product cadence. Product cadence is policy; the Cloudflare Cron Trigger is an
independent operational selection.

## Orchestration

For large work, split independent traversal, implementation, research, testing,
and adversarial review. Give each worker bounded ownership and ask for result,
decisions, changed areas, evidence, unresolved risks, and required integration
judgements. Coordinate overlapping files and do not repeat good delegated work.

Persist discoveries and decisions in canonical repository docs. Chat history is
not project memory.

## Evidence

Tests prove behaviour, not taste. Inspect screenshots, rendered frames, contact
sheets, full videos, audio measurements, mobile fallbacks, and reduced-motion
states. Collect the failure set, identify shared causes, fix the batch, then
rerun the relevant evidence. Never manufacture field data, provider contracts,
partner claims, render approval, or production state.
