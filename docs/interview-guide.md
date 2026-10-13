# Tixora V1 — System Architecture, Interview Guide & Technical Deep-Dive

This document provides a complete technical explanation of **Tixora**, detailing the real database architecture, concurrency models, security lifecycle, and the exact answers you can use in interviews when explaining this project.

---

## 1. Project High-Level Overview

**Tixora** is an architectural movie ticket discovery, auditorium seat reservation, and digital ticketing platform inspired by BookMyShow. Unlike generic CRUD applications or prototypes:
- It uses a **Modular Monolith** architecture with 15 bounded domains (`identity`, `users`, `catalog`, `cinemas`, `screens`, `showtimes`, `inventory`, `reservations`, `bookings`, `payments`, `tickets`, `notifications`, `administration`, `auditing`, `common`).
- It has **PostgreSQL as the single authoritative source of truth** for seat locks and confirmed bookings.
- It guarantees **Zero Double-Booking** under high concurrency via database row locking (`SELECT ... FOR UPDATE`).
- It decouples payment processing from booking confirmation to handle **late-payment race conditions** and webhook idempotency.
- It generates **cryptographically verifiable QR tickets** (`HMAC-SHA256`) that prevent duplicate check-ins at cinema gates.

---

## 2. Database Architecture & Runtime Engine

### Live Database Configuration
- **Database Engine**: **PostgreSQL 16 / 17**.
- **Active Connection**: `postgresql://tixora:3205@localhost:5432/tixora` (configured in `apps/api/.env`).
- **Connection Management**: Managed in [`apps/api/src/db/index.ts`](file:///c:/Users/harsh/Downloads/avtar-portfolio/Projects/TIXORA/apps/api/src/db/index.ts) using `pg.Pool` (connection pooling with 20 maximum connections, 30s idle timeout).
- **Embedded Fallback**: If `DATABASE_URL` is ever left blank (e.g. during offline testing or CI without a running PostgreSQL instance), the backend automatically falls back to an embedded PostgreSQL 16 engine ([`@electric-sql/pglite`](https://github.com/electric-sql/pglite)) with transaction mutex serialization.

### The 21 Production Database Tables
1. **`users`**: User identity, hashed passwords, contact details, preferred city, status (`ACTIVE`, `SUSPENDED`).
2. **`roles`**: Standard role definitions (`CUSTOMER`, `CINEMA_STAFF`, `CINEMA_MANAGER`, `PLATFORM_ADMIN`).
3. **`user_roles`**: Many-to-many role mapping.
4. **`refresh_sessions`**: Active login sessions, SHA-256 hashed refresh tokens, expiry timestamps, device info, replacement session pointers for token rotation.
5. **`cinema_staff`**: Scoped permissions linking cinema managers/staff to specific cinema locations (`UNIQUE(cinema_id, user_id)`).
6. **`movies`**: Film catalog, synopsis, duration, age rating, languages, genres, directors, cast JSONB, poster and backdrop URLs, IMDb ratings.
7. **`cinemas`**: Cinema locations, addresses, geographic coordinates, facilities, timezones, statuses.
8. **`screens`**: Auditoriums per cinema, projection format, sound systems, grid dimensions (`total_rows`, `total_cols`), turnaround intervals, layout versions.
9. **`seats`**: Physical seats belonging to screens (`row_label`, `seat_number`, `seat_code`, category, seat type, grid coordinates).
10. **`shows`**: Scheduled screenings linking a movie, cinema, and screen with start time, end time, turnaround end time, and category prices JSONB.
11. **`show_seats`**: **Authoritative per-show seat inventory**. Tracks per-show seat status (`AVAILABLE`, `HELD`, `BOOKED`, `BLOCKED`), active hold ID, hold expiration timestamp, booking reference, and optimistic locking version.
12. **`seat_holds`**: Temporary reservations with expiry timestamps (e.g., 8-minute window) and total amount.
13. **`seat_hold_items`**: Seats included in a specific temporary hold.
14. **`bookings`**: Booking records containing booking reference (`TXR-...`), user ID, hold ID, idempotency key, financial breakdown (subtotal, convenience fee, GST, total), and lifecycle statuses (`PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `EXPIRED`, `REFUND_REQUIRED`, `REFUNDED`).
15. **`booking_items`**: Line items of purchased seats with historical price preservation.
16. **`payments`**: Payment attempts, provider intent IDs, idempotency keys, payment methods, statuses, and reconciliation audit notes.
17. **`payment_events`**: Webhook event log enforcing webhook idempotency (`UNIQUE(event_id)`).
18. **`tickets`**: Issued tickets containing human-readable codes (`TIX-...`), cryptographically signed tokens (`TXQR...`), seat codes, and check-in statuses (`ISSUED`, `CHECKED_IN`, `VOIDED`).
19. **`ticket_checkins`**: Gate scan history tracking ticket check-in timestamps, verifying staff IDs, and recording verification results (`VALID_CHECKIN`, `DUPLICATE_REJECTED`, `INVALID_REJECTED`).
20. **`audit_logs`**: Immutable administrative and security audit trail tracking actors, roles, actions, entity IDs, metadata, and IP addresses.
21. **`outbox_events`**: Transactional outbox for asynchronous crash-resilient event dispatching.

---

## 3. Critical Engineering Workflows (Deep-Dive)

### A. Concurrency-Safe Seat Reservation (Preventing Double-Booking)
**Problem**: What happens when 100 users try to book the exact same seat (`D6`) at the exact same millisecond?

**Solution in Tixora**:
1. When a user requests seats (`POST /api/v1/seat-holds`), the backend runs inside a PostgreSQL transaction (`db.withTransaction`).
2. The requested seat codes are deduplicated and sorted alphabetically (e.g. `['D5', 'D6', 'D7']`).
3. The query acquires an exclusive row lock on those rows in ascending order:
   ```sql
   SELECT id, seat_code, category, price, status, active_hold_id, hold_expires_at
   FROM show_seats
   WHERE show_id = $1 AND seat_code = ANY($2::varchar[])
   ORDER BY seat_code ASC
   FOR UPDATE;
   ```
4. **Deterministic ordering (`ORDER BY seat_code ASC`)** eliminates circular wait conditions, making deadlocks impossible between concurrent multi-seat transactions.
5. If **any** of the locked seats is not `AVAILABLE`, the transaction rolls back immediately and returns `HTTP 409 Conflict`.
6. Only the single winning transaction transitions the seats to `HELD`, links the `active_hold_id`, and sets `hold_expires_at = NOW() + INTERVAL '8 minutes'`. All other 99 competing requests receive `HTTP 409 Conflict`.

### B. Payment Webhook Verification & Late-Payment Reconciliation
**Problem**: What happens if a customer's 8-minute seat hold expires while they are entering their OTP, another customer immediately grabs the seat, and then the first customer's bank webhook arrives late saying payment succeeded?

**Solution in Tixora**:
1. The frontend never confirms a ticket; only a verified webhook signed with `HMAC-SHA256` (`x-tixora-signature`) can confirm a booking.
2. Webhook processing is idempotent: `payment_events(event_id)` has a `UNIQUE` constraint. Replayed webhooks return the existing result without re-processing.
3. When `payment.succeeded` arrives, `PaymentsService.processWebhook()` locks the booking and the associated `show_seats` rows (`FOR UPDATE`).
4. **Safety Check**: The backend inspects whether the seats are still held by this specific hold:
   - **Normal Case**: The seats are still held by this hold. The seats transition to `BOOKED`, the booking transitions to `CONFIRMED`, and a signed `TXQR` ticket is issued.
   - **Late-Payment Race Condition**: The hold expired and another customer held/booked the seat. **Tixora never double-books the seat.** Instead:
     - The booking transitions to `REFUND_REQUIRED`.
     - The payment transitions to `REFUND_PENDING`.
     - An audit log event (`LATE_PAYMENT_REFUND_REQUIRED`) is emitted.
     - The automated reconciliation job processes a refund back to the customer.

### C. Cryptographic QR Gate Verification (`TXQR`)
**Problem**: How do we stop malicious users from guessing a sequential ticket number or using a screenshot of a ticket twice?

**Solution in Tixora**:
1. The QR code contains a signed token in format:
   `TXQR.<base64url(bookingId:showId:seats:nonce)>.<hmac_sha256_signature>`
2. When cinema staff scans the QR code at `/api/v1/manager/tickets/validate`:
   - The server verifies the HMAC signature using constant-time comparison (`crypto.timingSafeEqual`).
   - The server checks `cinema_staff` permissions to ensure the staff member is authorized for that cinema.
   - The ticket row is locked with `FOR UPDATE`. If `status === 'CHECKED_IN'`, the scan is rejected with `HTTP 409 Conflict` (`DUPLICATE_REJECTED`).
   - If valid, the ticket transitions to `CHECKED_IN` and a gate check-in log entry is created.

---

## 4. Interview Cheat Sheet: Questions & Ready-to-Use Answers

### Q1: "Walk me through the architecture of your Tixora project."
> **Answer**:  
> *"Tixora is a production-minded movie ticket booking platform built as a modular monolith using Node.js, Express, and TypeScript on the backend, Next.js 14 App Router and Tailwind CSS on the frontend, and PostgreSQL as the single source of truth.*  
> *I divided the backend into 15 domain modules such as identity, catalog, showtimes, inventory, reservations, bookings, and payments. Rather than prematurely introducing microservices and distributed transaction complexity (like 2PC or Sagas), the modular monolith allows me to execute ACID transactions across inventory and bookings in PostgreSQL while keeping clean boundaries so modules can be extracted into microservices in the future."*

### Q2: "How did you prevent two users from booking the same seat simultaneously? Did you use Redis?"
> **Answer**:  
> *"I deliberately chose PostgreSQL row locking over Redis for seat ownership correctness. While Redis is great for caching, relying on Redis TTLs for seat ownership creates dual-write consistency problems between Redis and the relational database.*  
> *In Tixora, when a reservation is initiated, I use PostgreSQL transactions with `SELECT ... FOR UPDATE` row locks. Crucially, I sort the seat codes in ascending order before locking them, which guarantees deterministic lock ordering and prevents deadlocks. If even one requested seat is unavailable, the entire transaction rolls back with all-or-nothing semantics. Confirmed bookings and temporary holds live in the same PostgreSQL schema, guaranteeing that an expired hold can never overwrite a confirmed ticket."*

### Q3: "How does the system handle payment webhooks and race conditions?"
> **Answer**:  
> *"Payment confirmation is strictly decoupled from client-side callbacks. The payment provider sends an HMAC-SHA256 signed webhook containing an `event_id`. The backend stores event IDs in a `payment_events` table to guarantee idempotency against replayed webhooks.*  
> *For edge cases where a customer's hold expires while paying and a competing customer claims the seat, the webhook handler locks the seat rows and verifies ownership before confirming. If another user has taken the seat, Tixora never double-books; it immediately marks the booking as `REFUND_REQUIRED` and the payment as `REFUND_PENDING` with an audit log trail, triggering automated reconciliation."*

### Q4: "How does authentication and authorization work?"
> **Answer**:  
> *"I implemented stateless JWT access tokens with short 15-minute expirations and rotating refresh tokens stored as SHA-256 hashes in PostgreSQL. When a refresh token is used, it is revoked and replaced with a new session. If an already-revoked refresh token is replayed, the server rejects it to defend against token theft.*  
> *For authorization, I implemented Role-Based Access Control with four roles: Customer, Cinema Staff, Cinema Manager, and Platform Admin. For cinema staff and managers, permissions are resource-scoped via a `cinema_staff` table. A cinema manager assigned to Mumbai cannot schedule screenings or view bookings for a cinema in Delhi, enforced at the middleware layer via `assertCinemaAccess`."*

### Q5: "How does ticket validation work at the venue?"
> **Answer**:  
> *"When a booking confirms, the server creates a unique `ticket_code` and a cryptographically signed QR token prefixed with `TXQR`. The token contains the booking ID, show ID, seat list, a cryptographic nonce, and an HMAC-SHA256 signature signed by the server's secret key.*  
> *At the cinema gate, staff use the QR validation endpoint. The backend verifies the cryptographic signature, checks cinema-scoping, and atomically updates the ticket from `ISSUED` to `CHECKED_IN`. If a customer or attacker tries scanning a screenshot of an already-used ticket, the database rejects it with an explicit duplicate check-in error."*

