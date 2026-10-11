# Tixora V1 — Payment Lifecycle & Late-Payment Reconciliation

## Separation of Payment State and Seat Confirmation

In Tixora, a payment callback from the frontend never directly confirms a ticket. Only a cryptographically verified webhook (`x-tixora-signature` HMAC-SHA256) processed by `PaymentsService.processWebhook()` can transition a booking to `CONFIRMED`.

```mermaid
sequenceDiagram
    participant C as Customer (Next.js)
    participant API as Tixora API (Express)
    participant DB as PostgreSQL (ACID)
    participant PGW as Payment Provider Sandbox

    C->>API: POST /api/v1/payments/intents (idempotencyKey)
    API->>DB: Verify active hold & create payment (PENDING)
    API-->>C: Return providerIntentId & clientSecret
    PGW->>API: POST /api/v1/payments/webhooks/tixora_sandbox (x-tixora-signature)
    API->>API: Verify HMAC-SHA256 signature (constant-time)
    API->>DB: BEGIN TRANSACTION + Check payment_events(event_id)
    alt Seats still owned by hold
        API->>DB: Update show_seats -> BOOKED, booking -> CONFIRMED, payment -> SUCCEEDED
        API->>DB: Issue signed TXQR ticket + Insert outbox_events
        API->>DB: COMMIT
    else Hold expired & seat claimed by Customer B (Late Payment Race)
        API->>DB: Do NOT overwrite seat! Mark booking -> REFUND_REQUIRED, payment -> REFUND_PENDING
        API->>DB: Record audit_logs(LATE_PAYMENT_REFUND_REQUIRED)
        API->>DB: COMMIT
    end
```

## Handling the Late-Payment Race Condition
If Customer A's 8-minute hold expires while their bank takes 9 minutes to clear payment, and Customer B claims the seat in the meantime:
1. When Customer A's `payment.succeeded` webhook arrives, `processWebhook` locks the `show_seats` rows (`FOR UPDATE`).
2. It detects that `active_hold_id !== booking.hold_id`.
3. **It never double-books the seat.** Instead, it transitions Customer A's booking to `REFUND_REQUIRED` and payment to `REFUND_PENDING`, which the background reconciliation job automatically refunds.

