# Feature Module: CRM & Pipeline Operations

## 1. Overview
The CRM module manages the sales deal lifecycle, lead ingestion, Kanban deal stage transitions (`Qualified`, `Discovery`, `Proposal Sent`, `Negotiation`, `Closed Won`), and sales activity task reminders.

---

## 2. Module Specifications

| Attribute | Specification |
| :--- | :--- |
| **Business Owner** | Head of Sales & Founder Operations |
| **Permissions Required** | `lead:create`, `lead:update_stage`, `lead:upload` |
| **Primary DB Tables** | `crm_leads`, `audit_logs` |
| **API Endpoints** | `/api/crm/pipeline`, `/api/crm/leads`, `/api/webhooks/odoo/crm` |
| **Metrics Consumed** | `PIPELINE_VELOCITY`, `WIN_RATE`, `AVG_DEAL_SIZE` |
| **Events Emitted** | `LeadCreated`, `LeadQualified`, `ProposalSent`, `ContractSigned` |

---

## 3. Directory Layout

```
src/features/crm/
├── components/          # PipelineKanbanBoard, NewLeadModal, OpportunityTable
├── hooks/               # useCrmPipeline, useLeadMutation
├── services/            # CrmPipelineService
├── repositories/        # crm.repository.ts
├── types/               # CrmLead, PipelineSummary
├── validators/          # createLeadSchema, updateStageSchema
└── README.md
```
