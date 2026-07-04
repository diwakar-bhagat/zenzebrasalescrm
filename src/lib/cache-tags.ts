/**
 * Next.js cache tags for analytics responses. The upload pipeline calls
 * `revalidateTag(...)` after a successful commit so a new upload immediately
 * invalidates cached dashboards (never serve stale data after an upload).
 */
export const CUSTOMER_INTELLIGENCE_TAG = "customer-intelligence";
