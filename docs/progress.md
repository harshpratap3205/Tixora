# Tixora V1 — Master Implementation Progress Tracker

## Environment & Toolchain Findings (Phase 1)
- **Workspace**: `c:\Users\harsh\Downloads\avtar-portfolio\Projects\TIXORA` (started empty)
- **Node.js / npm**: Node `v24.19.0`, npm `11.17.0`
- **Java**: Java 17 (`17.0.12 LTS`) installed on the local host. *Note*: Dockerfile and production configuration target Java 21 LTS; Maven compiler configuration supports Java 17+ so local builds and tests execute seamlessly on the host machine while remaining 100% compatible with Java 21 in Docker/CI.
- **Database**: Local PostgreSQL 16/17 services detected on ports `5432` and `5433`. Docker is not installed on the host. We provide:
  1. Full PostgreSQL production configuration + Flyway migrations (`db/migration/V1__init_schema.sql`, `V2__seed_demo_data.sql`).
  2. Automatic fallback/profile (`local-mem` / H2 in PostgreSQL compatibility mode or configurable `POSTGRES_URL`) so the backend and integration test suite can run immediately out-of-the-box without requiring Docker or external DB credentials, while supporting live PostgreSQL via environment variables (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`).

---

## Execution Phases

- [x] **Phase 1: Repository Inspection & Planning**
  - [x] Inspect repository and local toolchain
  - [x] Establish monorepo structure (`apps/web`, `apps/api`, `packages`, `infrastructure`, `docs`, `scripts`, `tests`)
  - [x] Create progress tracker (`docs/progress.md`)
- [ ] **Phase 2: Foundation**
  - [ ] Create root configuration (`README.md`, `.env.example`, `docker-compose.yml`, `.gitignore`)
  - [ ] Initialize Spring Boot backend (`apps/api`) with Maven Wrapper (`mvnw`, `mvnw.cmd`)
  - [ ] Configure Flyway schema migrations (`V1__init_schema.sql`, `V2__seed_demo_data.sql`)
  - [ ] Implement `common`, `identity`, `users`, and `auditing` modules (JWT access tokens, rotating refresh sessions, RBAC + cinema-scoped permissions)
  - [ ] Initialize Next.js App Router frontend (`apps/web`) with Tailwind CSS, TanStack Query, React Hook Form, Zod, Lucide Icons, and Framer Motion
- [ ] **Phase 3: Core Business Modules (Backend)**
  - [ ] `catalog` (Movies CRUD, filters, search, status)
  - [ ] `cinemas` & `screens` (Cinemas, cities, screens, dynamic seat layout configuration & versioning protection)
  - [ ] `showtimes` & `inventory` (Show scheduling, overlap & turnaround validation, category pricing, per-show seat inventory)
- [ ] **Phase 4: Booking Engine, Payments & Tickets (Backend Phases 5 & 6)**
  - [ ] `reservations` (Concurrency-safe atomic multi-seat holds, deterministic lock ordering, `AVAILABLE -> HELD -> BOOKED`, expiry cleanup)
  - [ ] `bookings` (Booking creation, idempotency, cancellation rules, summary)
  - [ ] `payments` (Provider adapter for Mock & Sandbox modes, signed webhook verification, idempotency via `payment_events`, late-payment reconciliation / `REFUND_REQUIRED` handling)
  - [ ] `tickets` (Cryptographically signed QR token generation, staff ticket check-in & duplicate scan prevention)
  - [ ] `notifications` & background jobs (Transactional outbox processor, expired hold cleaner, payment reconciliation scheduler)
  - [ ] `administration` (Manager & Platform Admin reporting, user/role management, audit log queries)
- [ ] **Phase 5: Customer Frontend & Dashboards (Frontend Phases 4 & 7)**
  - [ ] Editorial cinematic design system ("Noir & Amber Gold" aesthetic, custom typography pairing, accessible primitives)
  - [ ] Customer flows: Homepage, Movies listing & filters, Movie details & showtimes, Cinemas discovery, Interactive Seat Map with live hold countdown, Checkout & Sandbox Payment modal, My Bookings & QR Ticket view, Auth & Profile pages
  - [ ] Cinema Management Dashboard (`/manager`): Overview metrics, Cinemas, Screen layout designer, Showtime scheduler with conflict detection, Pricing, Bookings & QR Ticket scanner
  - [ ] Platform Admin Dashboard (`/admin`): Platform overview, Movie catalog CRUD, Cinema onboarding, User & role administration, Payment reconciliation viewer, Audit logs
- [ ] **Phase 6: Automated Testing & Quality Verification (Phase 8)**
  - [ ] Integration & concurrency test suite (competing seat holds, atomic multi-seat holds, hold expiry recovery, overlap prevention, webhook idempotency, late payment handling, duplicate QR check-in, cinema-scoped RBAC)
  - [ ] Frontend typecheck & production build verification
- [ ] **Phase 7: Documentation & Delivery (Phase 9)**
  - [ ] Complete all 9 architecture and operational documentation files in `docs/`
