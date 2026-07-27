# ADR-002: Additive API Response Envelope (`meta` header)

* **Status**: Accepted
* **Date**: 2026-07-27
* **Author**: ZenZebra Enterprise Architecture Team

## Context & Problem
API routes across ZenZebra return JSON payloads with varying top-level structures. To ensure enterprise-grade observability, telemetry, and debugging, we require timing, request identification, and versioning metadata without breaking existing frontend consumers.

## Decision
We will standardize all API routes by wrapping responses in an additive metadata envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_123456789",
    "executionTimeMs": 42,
    "generatedAt": "2026-07-27T13:48:00Z",
    "version": "v1"
  }
}
```

- Existing `data` keys and field types remain **100% unchanged**.
- Consumers expecting `{ success: true, data: { ... } }` will continue to work seamlessly.
- `meta` provides lightweight timing and telemetry for performance budget tracking (<200ms API target).

## Rollback Strategy
The `meta` block is purely additive. If removed or disabled, existing consumers function without interruption.
