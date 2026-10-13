# TIXORA — Premiere Movie Ticket Booking & Reservation Platform

> **Your Seat. Your Show. Your Moment.**  
> A complete, production-minded full-stack movie discovery, cinema operations, concurrency-safe PostgreSQL seat reservation, payment webhook reconciliation, and cryptographic QR ticketing platform.

---

## 1. Technology Stack

- **Frontend (`apps/web`)**: Next.js 14 (App Router), React 18, TypeScript (Strict), Tailwind CSS ("Noir & Amber Gold" editorial visual system), TanStack Query v5, React Hook Form + Zod, Lucide Icons, `qrcode.react`.
- **Backend (`apps/api`)**: Node.js, Express.js, TypeScript (Strict), Modular Monolith architecture across 15 domain modules (`common`, `identity`, `users`, `catalog`, `cinemas`, `screens`, `showtimes`, `inventory`, `reservations`, `bookings`, `payments`, `tickets`, `notifications`, `administration`, `auditing`).
- **Database**: PostgreSQL 16/17 (`pg` connection pool + zero-config embedded PostgreSQL 16 via `@electric-sql/pglite` when `DATABASE_URL` is unset), versioned SQL schema migrations (`V1__init_schema.sql`), and automated demo seeding (`seed.ts`).
- **Quality & Docs**: Vitest + Supertest integration & concurrency test suite, OpenAPI 3.0 / Swagger UI (`/api-docs`), Docker & Docker Compose.

---

## 2. Repository Structure

```text
tixora/
├── apps/
│   ├── api/                  # Node.js + Express + TypeScript Modular Monolith API
│   └── web/                  # Next.js App Router Customer, Manager & Admin Web App
├── docs/                     # Complete engineering & architecture documentation
├── .env.example              # Documented environment variable template
├── docker-compose.yml        # Full-stack PostgreSQL + API + Web container orchestration
└── package.json              # Root npm workspaces configuration
```

---

## 3. Quick Start

### Install & Run Tests
```bash
npm install
npm test
```

### Start Backend & Frontend
```bash
# Terminal 1: Start Express API on http://localhost:8080 (Swagger UI at http://localhost:8080/api-docs)
npm run dev:api

# Terminal 2: Start Next.js Web App on http://localhost:3000
npm run dev:web
```

### Seeded Demo Accounts (Password for all: `Tixora@2026`)
You can also switch between these accounts in 1 click using the **Instant Demo Session Switcher** bar at the top of the web UI:
- **Customer**: `aarav@tixora.cinema`
- **Cinema Manager (Mumbai Scoped)**: `manager@tixora.cinema`
- **Cinema Manager (New Delhi Scoped)**: `delhi.manager@tixora.cinema`
- **Cinema Gate Staff (Mumbai)**: `staff@tixora.cinema`
- **Platform Super-Admin**: `admin@tixora.cinema`

---

## 4. Engineering Documentation (`docs/`)

- [Interview Guide & Technical Architecture Deep-Dive](docs/interview-guide.md)
- [Secrets, Credentials & Production Integration Guide](docs/secrets-guide.md)
- [Architecture Blueprint](docs/architecture.md)
- [Database Schema & ER Diagram](docs/database-schema.md)
- [REST API Contracts (`/api/v1`)](docs/api-contracts.md)
- [Authentication & Scoped RBAC](docs/authentication.md)
- [Concurrency-Safe Seat Reservation & Booking Lifecycle](docs/booking-lifecycle.md)
- [Payment Webhook Verification & Late-Payment Reconciliation](docs/payment-lifecycle.md)
- [Architectural Decisions (ADR)](docs/decisions.md)
- [Testing & Concurrency Suite](docs/testing.md)
- [Deployment & Docker Guide](docs/deployment.md)
- [Implementation Progress Tracker](docs/progress.md)
