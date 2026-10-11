# Tixora V1 — System Architecture Blueprint

## 1. Architectural Philosophy: Production-Minded Modular Monolith

Tixora V1 is engineered as a **Modular Monolith** using **Node.js + Express + TypeScript** on the backend, **Next.js (App Router) + Tailwind CSS + TanStack Query** on the frontend, and **PostgreSQL** as the single authoritative source of truth.

```mermaid
flowchart TD
    subgraph Clients["User Interfaces (apps/web — Next.js App Router)"]
        Cust["Customer Storefront (/, /movies, /shows/[id]/seats, /checkout)"]
        Mgr["Cinema Manager Portal (/manager — Scoped RBAC)"]
        Adm["Platform Admin Console (/admin — Global Governance)"]
    end

    subgraph API["Tixora Modular Monolith API (apps/api — Express + TypeScript)"]
        Gateway["REST API Router (/api/v1) + JWT/RBAC Middleware + Zod Validation"]
        IdMod["identity & users"]
        CatMod["catalog, cinemas, screens, showtimes"]
        InvMod["inventory & reservations (PostgreSQL FOR UPDATE Lock Engine)"]
        BookMod["bookings & payments (Signed Webhook Reconciliation)"]
        TickMod["tickets (HMAC-SHA256 QR Issuing & Gate Check-in)"]
        JobMod["notifications & auditing (Transactional Outbox)"]
    end

    subgraph Storage["Persistence & External Adapters"]
        PG[("PostgreSQL 16 (ACID Transactions & Row Locks)")]
        Pay["Sandbox Payment Provider (HMAC-SHA256 Signed Webhooks)"]
    end

    Clients --> Gateway
    Gateway --> IdMod
    Gateway --> CatMod
    Gateway --> InvMod
    Gateway --> BookMod
    Gateway --> TickMod
    Gateway --> JobMod

    IdMod --> PG
    CatMod --> PG
    InvMod --> PG
    BookMod --> PG
    TickMod --> PG
    JobMod --> PG
    Pay -->|POST /api/v1/payments/webhooks/:provider| BookMod
```

## 2. Module Boundaries (`apps/api/src/modules/`)

| Module | Responsibility | Key Guarantees |
| :--- | :--- | :--- |
| `common` | Config, Pino secret-redacted logging, `AppError`, OpenAPI 3.0 spec | Standardized JSON error envelopes |
| `identity` | Registration, login, JWT access tokens, rotating refresh sessions, RBAC | Replay protection on rotated refresh tokens |
| `users` | Customer profile, preferred city, booking & ticket history | Strict ownership isolation |
| `catalog` | Movie CRUD, search, language/genre/status filters | Slug & UUID lookup support |
| `cinemas` | Cities, cinema locations, facility metadata | Cinema-level staff scoping (`cinema_staff`) |
| `screens` | Auditorium dimensions, turnaround buffers, physical seat matrices | Protects sold/held seats when updating layouts |
| `showtimes` | Show scheduling, category pricing, overlap detection | Rejects overlapping screenings + turnaround buffers (`409 Conflict`) |
| `inventory` | Per-show seat availability (`show_seats`), lazy & scheduled hold expiry | Real-time state transitions |
| `reservations` | Multi-seat atomic holds (`seat_holds`, `seat_hold_items`) | Deterministic lock ordering (`ORDER BY seat_code ASC FOR UPDATE`) |
| `bookings` | Pending-payment bookings, idempotency keys, cancellation rules | Idempotent creation; automatic seat release on cancel |
| `payments` | Payment intents, HMAC webhook verification, late-payment reconciliation | Separates payment state from seat confirmation |
| `tickets` | Cryptographic `TXQR` token generation and gate validation | Prevents forged QR codes and duplicate check-ins |
| `notifications` | Transactional outbox processor & background workers | Crash-resilient asynchronous processing |
| `administration` | Cinema Manager & Platform Admin reporting and governance | Enforces `assertCinemaAccess` on every manager action |
| `auditing` | Immutable administrative and security audit trail (`audit_logs`) | Full traceability of state changes |

## 3. Evolution Path Toward FlowGuard Gateway Integration

Because all business endpoints are cleanly versioned under `/api/v1` with stateless Bearer JWT verification and idempotency keys (`idempotency_key` on `bookings` and `payments`), **FlowGuard** can be deployed directly in front of `apps/api` as an L7 traffic shaper, token-bucket rate limiter, and virtual waiting-room queue for blockbuster movie drops without altering Tixora's transactional core.

