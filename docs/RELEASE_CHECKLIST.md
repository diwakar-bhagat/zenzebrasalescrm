# ZenZebra CRM: Release Governance & Deployment Checklist

## Pre-Release Verification Protocol

- [ ] **Typecheck Clean**: `npm run check` passes with 0 type errors.
- [ ] **Lint Clean**: `npm run lint` passes with 0 syntax or rule errors.
- [ ] **Ground-Truth Verification**: `npx ts-node -P tsconfig.scripts.json src/scripts/verify-ground-truth.ts` returns clean match on KLJ & Smartworks Noida sales figures.
- [ ] **DB Migrations Executed**: All Neon PostgreSQL table migrations applied (`crm_leads`, `purchase_orders`, `audit_logs`).
- [ ] **Odoo Webhook Secret**: `ODOO_WEBHOOK_SECRET` variable set in production host environment.

## Rollback Plan

In the event of a critical API or DB regression:
1. Revert Next.js deployment to previous green commit tag.
2. If DB schema modification occurred, run migration rollback scripts in `src/scripts/`.
3. Flush Redis / Server cache layer.
4. Notify Founder & Operations leads via Notification Channel.
