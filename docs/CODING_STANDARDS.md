# ZenZebra CRM: Engineering & Coding Standards

## 1. Feature-First Module Structure

All new features and refactored components must reside in `src/features/[feature_name]/` following this structure:

```
src/features/[feature_name]/
├── components/      # UI components specific to this feature
├── hooks/           # Custom React hooks (React Query / Zustand)
├── services/        # Business domain services
├── repositories/    # Database queries and Neon PostgreSQL access
├── types/           # DTOs and TypeScript interfaces
├── constants/       # Feature-specific constants and enums
├── validators/      # Zod validation schemas
├── tests/           # Feature unit & integration tests
└── README.md        # Documentation for this feature module
```

---

## 2. Business Logic Layer Separation

Code MUST strictly observe 5-tier layer separation:

1. **API Controller (`src/app/api/v1/...`)**: Handles HTTP requests, authentication, and Zod input validation. Does NOT contain SQL or math calculations.
2. **Service (`src/features/*/services/`)**: Orchestrates workflows, dispatches events, and calls metrics engine or repositories.
3. **Metrics Engine (`src/lib/metrics/engine.ts`)**: Pure mathematical functions with zero side-effects. Contains all KPI calculations (AOV, LTV, CAC, RFM, Win Rate).
4. **Repository (`src/lib/repositories/`)**: Encapsulates raw SQL queries against Neon DB (`sales_fact_v`, `crm_leads`, `purchase_orders`).
5. **Database (Neon PostgreSQL)**: Raw facts, staging tables, materialized views.

---

## 3. State Management Rules

- **Server State**: Managed exclusively via `@tanstack/react-query`.
- **Filter State**: Managed via global Zustand stores (`useFilterStore`).
- **Form State**: Managed via `react-hook-form` + `zod` validation schemas.
- **UI State**: Kept local to React components via `useState` / `useReducer`.

---

## 4. Strict Type Safety & No Technical Debt

- `any` and `unknown` types are strictly prohibited in production code.
- Magic strings and hardcoded numbers must be extracted to `constants/`.
- Component props must be typed with explicit interfaces.
