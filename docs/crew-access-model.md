# Cyre — crew access model

Scope: the bot crew and the Cursor agents that execute their tasks.
Status: steps 1–2 shipped (allowlists + echo-back). Enforcement (steps 3–4) not built.

Source of allowlists: `config/crew/allowlists/<role>.yaml`
Task ceremony: `config/crew/TASK_PROMPT_TEMPLATE.md`
Cursor rule: `.cursor/rules/crew-access.mdc`

## The failure this fixes

A Cursor cloud agent opened a PR on `milesdev888/-Cyre-Guardian`
while running a task that had nothing to do with that repo. The
agent's own GitHub connector was scoped correctly. The connector was
not the thing that chose the repo — the executor was.

That is the whole lesson: **scoping the connector does not scope the
work.** Access was being policed by hand, per task, by remembering
which agent was pointed where. That does not survive a tired evening.

The cyre.dev 404 had the same shape from a different angle: an agent
changed a project-level build setting as a side effect of a feature
PR, and nothing in the system said "this file is not yours to touch."

## The split

Two different things are being conflated. Separate them:

**Capabilities live at the account level.** Browsing, shell, file
handling, the ability to call an API. Many crew members legitimately
need the same tools. Duplicating tool config per bot creates drift
and tells you nothing about safety.

**Context lives at the role level.** What a given crew member knows,
what it remembers, and crucially *what it is allowed to reach*.
Guardian's scanner context is not Ship's deploy context.

Capabilities can be shared broadly. Context stays with the role that
needs it.

## Default deny

Every crew member starts with zero reachable resources and is granted
specific ones. Not "has a connector scoped to X" — an explicit
allowlist the executor checks before it acts.

Per role, declare `repos`, `paths_writable`, `paths_denied`,
`services`, and `settings` in `config/crew/allowlists/<role>.yaml`.

`paths_denied` is the piece that would have caught the 404. Build
config, workflow files and dependency manifests are infrastructure,
not feature work. A feature PR that needs to touch them is a PR that
needs a human to look at it.

`settings: none` means the role cannot change project-level
configuration in Vercel or Render — only the code. Output Directory
is a setting. Nothing in the crew should be able to set it.

## Executor binding

The rule that closes the original gap:

> The allowlist belongs to the **task**, and the executor must
> re-read it at execution time. A task carries its role. An executor
> that cannot determine which role it is running as refuses to act.

Concretely: the task prompt states the role, and the first thing the
executor does is echo back which repo and which paths it believes it
may write. If that echo does not match the task, stop there. That
one line of ceremony would have surfaced the wrong-repo PR before it
was opened rather than after.

## Audit

Every write records role, repo, path, and the task id that authorized
it. Not for compliance — so that the next time something lands
somewhere unexpected, the question "which executor did this" has an
answer in seconds instead of an evening.

## What not to build

- No permissions UI. This is a config file in the repo and a check in
  the executor prompt.
- No approval workflow for ordinary code changes. The crew shipping
  features unattended is the point; the allowlist exists so that
  freedom is bounded, not supervised.
- Do not try to enforce this through connector scopes alone. That is
  what was already being relied on, and it is what failed.

## Build order

1. Write the per-role allowlist file. Just the document — no
   enforcement. Roles: Chief of Staff, Guardian, Guardian Engineer,
   Ship, Research. **Done.**
2. Add the echo-back step to every task prompt template. Costs
   nothing, catches the wrong-executor case immediately. **Done.**
3. Add `paths_denied` enforcement to the executor: refuse the write,
   report, do not open the PR.
4. Audit line on every write.

## Open question

Where the allowlist file lives. In-repo means an agent with write
access to the repo can edit its own permissions. Outside the repo
means another place to keep in sync. Leaning in-repo with
`paths_denied` covering the allowlist file itself — imperfect, but
the alternative is infrastructure nobody maintains.
