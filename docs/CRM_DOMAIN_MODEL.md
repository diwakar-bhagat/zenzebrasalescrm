# ZenZebra CRM: Domain Model & Lifecycle Blueprint

This document defines the lifecycle states, ownership controls, transition rules, and event emissions across the **ZenZebra CRM Domain Model**.

---

## 1. CRM Deal Lifecycle Pipeline

```
┌──────────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────┐
│   Lead   ├────►│ Qualification ├────►│ Opportunity ├────►│ Proposal │
└──────────┘     └───────────────┘     └─────────────┘     └────┬─────┘
                                                                │
┌──────────┐     ┌───────────────┐     ┌─────────────┐          │
│ Retention│◄────┤   Customer    │◄────┤   Payment   │◄─────────┘
└──────────┘     └───────────────┘     └─────────────┘
```

---

## 2. Stage Transition Rules & Audit Protocol

Every stage transition MUST generate an audit entry in `audit_logs` capturing:
- `actor_id` / `salesperson`
- `entity_type` (`crm_lead`)
- `entity_id`
- `before_state`
- `after_state`
- `timestamp`

| Stage | Trigger / Action | Validation Criteria | Domain Event Emitted |
| :--- | :--- | :--- | :--- |
| **Lead** | Inbound query or webhook | Valid contact name & phone/email | `LeadCreated` |
| **Qualification** | Initial contact call | Lead score >= 50 or store assigned | `LeadQualified` |
| **Opportunity** | Requirements gathered | `expected_revenue` specified | `OpportunityCreated` |
| **Proposal** | Quote / Proposal sent | Document attached or line items set | `ProposalSent` |
| **Negotiation** | Terms review | Margin % validated | `NegotiationStarted` |
| **Closed Won** | Deal signed | Closed date & final value locked | `ContractSigned` |
| **Payment / Customer**| First invoice paid | Record synced to `sales_fact` | `CustomerCreated` |
