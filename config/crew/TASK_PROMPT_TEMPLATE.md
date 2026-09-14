# Crew task prompt template

Paste this block at the top of every crew / Cursor cloud agent task.
Replace `<ROLE>` with one of: `ship`, `guardian`, `guardian-engineer`,
`chief-of-staff`, `research`.

---

## Role

`<ROLE>`

Allowlist: `config/crew/allowlists/<ROLE>.yaml`
Model: `docs/crew-access-model.md`

## Executor ceremony (required — do this before any write)

1. Read the allowlist file for this role.
2. Echo back, in one short block:

```text
ROLE: <role>
REPO: <repo I will write to>
PATHS_WRITABLE: <summary of allowed globs>
PATHS_DENIED: <summary — especially vercel.json, package.json, workflows, allowlists>
SETTINGS: none
```

3. If you cannot determine the role, or the echo does not match this
   task's role/repo, **stop**. Do not edit files. Do not open a PR.
4. Never change Vercel or Render **project settings** (Output Directory,
   Root Directory, Build Command, env). `settings: none`.
5. If the task requires a `paths_denied` file, stop and report — that
   change needs a human, not a feature PR.

## Task

<human task text here>
