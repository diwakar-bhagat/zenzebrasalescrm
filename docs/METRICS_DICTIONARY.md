# ZenZebra CRM: Universal Metrics Dictionary

This document serves as the single source of truth for all business logic metrics in **ZenZebra Sales CRM**.

---

## 1. Sales & Financial Metrics

| Metric | Formula | Required Fields | Interpretation & Edge Cases |
| :--- | :--- | :--- | :--- |
| **Gross Sales Revenue** | `SUM(net_amount)` | `net_amount` | Aggregate net revenue from `sales_fact_v` view. Excludes non-retail test staff accounts. |
| **Average Order Value (AOV)** | `Gross Revenue / Total Distinct Orders` | `net_amount`, `bill_no` | Returns `0` if order count is `0`. Filtered by mirror comparison periods. |
| **Gross Margin (₹)** | `Gross Revenue - Total Purchase Spend` | `net_amount`, `amount_total` | Contribution margin after direct purchase order expenditure. |
| **Gross Margin (%)** | `(Gross Margin / Gross Revenue) * 100` | `net_amount`, `amount_total` | Returns `0` if Gross Revenue is `0`. |
| **Net Margin (%)** | `(Net Operating Income / Gross Revenue) * 100` | `net_amount`, `operating_expenses` | Net profit margin post-all expenses. |

---

## 2. Customer Retention & LTV Metrics

| Metric | Formula | Required Fields | Interpretation & Edge Cases |
| :--- | :--- | :--- | :--- |
| **Repeat Purchase Rate** | `(Repeat Customers / Total Unique Customers) * 100` | `customer_mobile` | Percentage of customers with >1 lifetime transaction. |
| **Customer Retention Rate** | `(Active End Customers - New Customers) / Start Customers` | `customer_mobile`, `sale_date` | Cohort-based monthly retention rate. |
| **Customer Lifetime Value (LTV)** | `AOV * Purchase Frequency * Customer Lifespan` | `net_amount`, `customer_mobile` | Estimated total value per customer cohort over 12 months. |
| **Customer Acquisition Cost (CAC)** | `Total Marketing Spend / New Customers Acquired` | `marketing_spend`, `customer_mobile` | Blended cost to acquire one new customer. |
| **CAC Payback Period** | `CAC / (AOV * Gross Margin %)` | `CAC`, `AOV`, `Gross Margin %` | Months required to recover acquisition expenditure. |

---

## 3. Customer Intelligence & RFM Scoring

| Metric | Formula | Scale / Output |
| :--- | :--- | :--- |
| **Recency (R)** | Days elapsed since latest transaction | Score 1 to 5 (5 = bought < 7 days ago) |
| **Frequency (F)** | Total order count per customer | Score 1 to 5 (5 = > 10 orders) |
| **Monetary (M)** | Total lifetime spend per customer | Score 1 to 5 (5 = top 20th percentile) |
| **RFM Segment** | Champions, Loyal, At Risk, Lost | Derived from composite RFM score |

---

## 4. CRM & Sales Pipeline Velocity

| Metric | Formula | Required Fields |
| :--- | :--- | :--- |
| **Pipeline Velocity** | `(Qualified Deals * Win Rate % * Avg Deal Size) / Sales Cycle Days` | `expected_revenue`, `stage`, `date_deadline` |
| **Win Rate %** | `(Closed Won Deals / Total Closed Deals) * 100` | `stage`, `won` |
| **Average Deal Size** | `SUM(expected_revenue) / Total Opportunities` | `expected_revenue` |
| **Proposal Conversion %** | `(Negotiation Deals / Proposal Sent Deals) * 100` | `stage` |
