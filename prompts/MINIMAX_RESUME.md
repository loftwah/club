# MiniMax Resume Prompt

Read `AI_START_HERE.md`, `AGENTS.md`, `PROJECT_BRIEF.md`, `MASTER_SPEC.md` and `config/ENVIRONMENT.md`.

Inspect current git status, recent commits, current tests and actual implementation state. Resume from the repository rather than assuming what a previous agent completed.

Preserve product invariants. Do not repeat finished work. Do not silently decide open product questions. Run local checks as work proceeds. Finish with `mise run acceptance`. If it fails, continue. If a real user decision blocks progress, ask exactly that question.
