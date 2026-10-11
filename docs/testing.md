# Tixora V1 — Automated Testing & Concurrency Verification

## Running the Test Suite

From the repository root:
```bash
npm test
```

## Covered Integration & Concurrency Scenarios (`apps/api/src/__tests__/tixora.integration.test.ts`)

1. **Health & Readiness Probe**: Verifies `/api/v1/health` and live PostgreSQL connectivity.
2. **Authentication & Session Rotation**: Tests registration, login, refresh token rotation, and verifies that replaying a rotated refresh token is rejected with `401 Unauthorized`.
3. **Role & Cinema-Scoped Authorization**: Verifies that the Delhi Cinema Manager receives `403 Forbidden` when attempting to modify a Mumbai cinema, while the Mumbai Cinema Manager succeeds (`200 OK`).
4. **Showtime Overlap & Turnaround Prevention**: Verifies that scheduling a screening on the same auditorium screen within an existing show's runtime + turnaround window fails with `409 Conflict`.
5. **High-Concurrency Seat Reservation Test**: Fires **20 simultaneous competing requests** for seat `D6` on the same show. Verifies that **exactly 1 request succeeds (`201 Created`)** and **19 requests fail with `409 Conflict`**.
6. **Multi-Seat All-or-Nothing Atomicity**: Requests `['D5', 'D6', 'D7']` where `D6` is already held. Verifies the entire request rolls back (`409 Conflict`) and leaves `D5` and `D7` `AVAILABLE` for subsequent reservation.
7. **Idempotent Booking, Signed Webhook & QR Gate Check-in**: Verifies duplicate booking idempotency, rejects forged webhook signatures (`401`), processes valid HMAC-signed webhooks idempotently, issues a `TXQR` cryptographic ticket, checks in at the gate (`200 OK`), and rejects a second scan of the same ticket (`409 Conflict`).
8. **Late-Payment Race Condition Reconciliation**: Simulates a hold expiring, a second customer claiming the seat, and the first customer's payment webhook arriving late. Verifies the seat is never double-booked and the first booking transitions to `REFUND_REQUIRED` / `REFUND_PENDING`.

