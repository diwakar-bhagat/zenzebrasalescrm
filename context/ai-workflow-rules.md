# ZenZebra CRM — AI Workflow Rules

## Read order

Before implementing or making any architectural decision, read in order:
1. `project-overview.md`
2. `architecture.md`
3. `ui-context.md`
4. `code-standards.md`
5. `ai-workflow-rules.md` (this file)
6. `progress-tracker.md`

This mirrors the rule in the repo root `CLAUDE.md` (and the global
`~/Documents/CLAUDE.md`) — it is not new, just made explicit here.

## Ground truth over any pasted plan

If a user-pasted planning document (ChatGPT output, a spec, a brainstorm)
conflicts with what's actually in this repo — column names, folder
structure, existing services, existing views — **the repo wins.** Verify
against code before proposing a design based on a pasted plan. Concretely:
this project's Customer Retention module (overview/cohorts/segments/ltv/
cac/health) is **already built**; treat any resemblance to an external plan
as coincidental, and always check the real files (`src/lib/services/`,
`src/app/api/customer-retention/`, `src/app/(main)/dashboard/retention/`)
before assuming a page or metric doesn't exist yet.

## Don't invent architecture

- No `repositories/` layer — services query the DB directly (see
  `architecture.md`). Don't add one because a plan suggested it.
- No new metrics/formulas without first checking `lib/business-logic/` and
  `lib/services/` for an existing definition. LTV, CAC, retention rate,
  RFM health score, cohort retention/AOV/bill-cuts are all already defined
  — reuse them, don't reintroduce a slightly different formula under a new
  name.
- No new folders under `src/` that don't match the existing top-level
  structure (`app`, `components`, `config`, `data`, `hooks`, `lib`,
  `navigation`, `server`, `stores`, `styles`, `types`).

## Scope discipline

- One module/page at a time. Don't fan out into building six pages in one
  pass when asked about one.
- Don't add auth to currently-unauthenticated routes, don't run DB
  migrations, don't touch marketing-spend constants, without confirming
  with the user first — these are flagged as open items in
  `progress-tracker.md` precisely because they need a decision, not a
  silent fix.
- Match `ui-context.md` visual conventions exactly for any new UI — the
  glass-card/MetricCard/heatmap patterns already exist; don't redesign.

## Next.js version discipline

Check `node_modules/next/dist/docs/` for version-specific behavior (App
Router, Route Handlers, Server/Client Components, data fetching, config,
middleware, caching, deprecations) before writing Next.js code — this repo
runs Next 16.2.4, which has breaking changes vs. older training-era
patterns. This is enforced by `AGENTS.md` at the repo root; don't skip it
because a task "looks like a one-liner."

## Progress tracking

Update `progress-tracker.md` after each meaningful implementation change —
what shipped, what's still open, what decision is now needed from the user.
If an implementation changes the architecture, scope, or standards
documented in these context files, update the relevant file *before*
continuing, not after.

## When you find a real gap or hardcoded assumption

Surface it (e.g. unauthenticated API routes, unused DB views, hardcoded CAC
spend constants — see `progress-tracker.md`) rather than silently fixing or
silently ignoring it. These are business/product decisions, not bugs to
patch on sight.
