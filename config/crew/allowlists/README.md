# Crew allowlists

Default deny. Each role file grants specific repos, writable paths,
services, and settings. See `docs/crew-access-model.md`.

Roles:

| Role | File |
|------|------|
| Chief of Staff | `chief-of-staff.yaml` |
| Guardian | `guardian.yaml` |
| Guardian Engineer | `guardian-engineer.yaml` |
| Ship | `ship.yaml` |
| Research | `research.yaml` |

Every role denies writes to this directory (`config/crew/allowlists/**`)
and to infrastructure paths (`vercel.json`, `package.json`,
`.github/workflows/**`). `settings: none` — no Vercel/Render project
settings changes.

Enforcement (refuse write / no PR) is not wired yet. Echo-back is
required now — see `../TASK_PROMPT_TEMPLATE.md`.
