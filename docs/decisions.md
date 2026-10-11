# Tixora V1 — Architectural Decisions Record (ADR)

## ADR-01: Modular Monolith over Premature Microservices
- **Decision**: Build V1 as a single deployable Node.js/Express application organized into 15 strict domain modules (`identity`, `users`, `catalog`, `cinemas`, `screens`, `showtimes`, `inventory`, `reservations`, `bookings`, `payments`, `tickets`, `notifications`, `administration`, `auditing`, `common`).
- **Rationale**: Allows atomic ACID transactions across `seat_holds`, `show_seats`, `bookings`, `payments`, `tickets`, and `outbox_events` without 2PC/Saga complexity.

## ADR-02: PostgreSQL as Authoritative Seat Reservation Engine (No Redis TTL Reliance)
- **Decision**: Use PostgreSQL `SELECT ... FOR UPDATE` row locking and transactional state transitions (`AVAILABLE -> HELD -> BOOKED`) instead of relying on Redis key TTLs for seat locking.
- **Rationale**: Redis TTL expiration is asynchronous and non-transactional with relational booking confirmation. Keeping both holds and confirmed bookings in PostgreSQL eliminates split-brain dual-write bugs.

## ADR-03: Dual-Mode PostgreSQL Engine (`pg.Pool` + Embedded `PGlite`)
- **Decision**: Support external PostgreSQL 16/17 via `DATABASE_URL` in production/Docker while seamlessly providing embedded PostgreSQL 16 (`@electric-sql/pglite`) when `DATABASE_URL` is unset.
- **Rationale**: Guarantees 100% real PostgreSQL SQL syntax, constraints, arrays, JSONB, and ACID transactions in local development and CI even on machines without Docker installed.

## ADR-04: Cryptographically Signed QR Tokens (`TXQR`)
- **Decision**: Sign ticket payloads (`bookingId:showId:seatCodes:nonce`) with `HMAC-SHA256` using `QR_SIGNING_SECRET`.
- **Rationale**: Prevents attackers from guessing sequential booking IDs or forging entry passes at cinema gates.

