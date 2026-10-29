# Tixora – Movie Ticket Booking Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2F17-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg)](https://www.docker.com/)
[![Vitest](https://img.shields.io/badge/Tests-8%20Passed-brightgreen.svg)](https://vitest.dev/)
[![Swagger](https://img.shields.io/badge/OpenAPI%203.0-Swagger%20UI-85EA2D.svg)](http://localhost:8080/api-docs)

> **Resume Summary**:  
> **Tech Stack**: Next.js, TypeScript, Node.js, Express.js, PostgreSQL, Docker  
> • Built a booking platform with **customer, cinema, and admin portals** for showtimes, seats, and QR tickets.  
> • Added **JWT refresh sessions**, **Zod validation**, **Swagger docs**, and **integration tests**.

---

## 🚀 Live Demo & Production Links
- **Web Application (Vercel)**: [https://tixora.harshthedev.ccwu.cc](https://tixora.harshthedev.ccwu.cc)
- **Backend API (Render)**: [https://tixora-6j4h.onrender.com](https://tixora-6j4h.onrender.com)
- **Swagger / OpenAPI Documentation**: [https://tixora-6j4h.onrender.com/api-docs](https://tixora-6j4h.onrender.com/api-docs) (or local: `http://localhost:8080/api-docs`)
- **Health Endpoint**: [https://tixora-6j4h.onrender.com/health](https://tixora-6j4h.onrender.com/health)

---

## 📋 Key Portals & Capabilities

### 1. 🎟️ Customer Portal (`/`, `/movies`, `/cinemas`, `/shows/[id]/seats`, `/bookings`)
- **Movie Catalog & Trailer Modal**: Live streaming embedded YouTube trailers, filter by genre, city, and language.
- **Interactive Auditorium Seat Matrix**: Real-time seat grid rendered across **Standard, Prime, Recliner, and IMAX VIP** tiers.
- **Concurrency-Safe Seat Reservation**: 8-minute temporary hold with active countdown timer and atomic PostgreSQL row locks (`SELECT ... FOR UPDATE`).
- **Cryptographic QR Ticketing**: Verified tickets signed with HMAC-SHA256 (`TXQR...`), downloadable digital ticket passes, and booking history.

### 2. 🎬 Cinema & Manager Portal (`/manager`)
- **Multi-Cinema Scoped Access**: Role-Based Access Control (RBAC) ensuring managers only manage screens, shows, and seating within their assigned city and cinema.
- **Screen & Show Scheduling**: Real-time screening calendar with automated cleaning/turnaround intervals.
- **Gate Pass QR Scanner & Validator**: Real-time QR ticket scanner that validates cryptographic signatures and **rejects duplicate check-ins** with audit trail logging.

### 3. 🛡️ Admin Portal (`/admin`)
- **Platform Analytics**: Revenue statistics, ticket velocity, active seat holds, and occupancy percentages.
- **Cinema & Screen Operations**: Manage auditorium grid layouts (rows, columns, aisle gaps, couple seats).
- **Security & Financial Audit Trail**: Comprehensive audit logs (`audit_logs`) tracking user access, role assignments, cancellations, and payment reconciliations.

---

## 🔒 Security, Concurrency & Core Architecture

| Core Capability | Architectural Implementation |
| :--- | :--- |
| **Concurrency Locking** | Uses PostgreSQL `SELECT ... FOR UPDATE` with **deterministic ascending sorting** (`ORDER BY seat_code ASC`) to eliminate deadlocks and guarantee zero double-booking under high concurrency. |
| **JWT Refresh Sessions** | Short-lived 15-minute access tokens + rotating HTTP-only refresh tokens stored as SHA-256 hashes in PostgreSQL with family reuse detection. |
| **Schema Validation** | End-to-end request validation using **Zod schemas** on every API endpoint. |
| **API Documentation** | Interactive **OpenAPI 3.0 / Swagger UI** at `/api-docs` documenting all 22+ endpoints. |
| **Payment Reconciliation** | Idempotent webhook handling with HMAC-SHA256 signature verification. Automatically marks late payments as `REFUND_REQUIRED` if seats were claimed after hold expiration. |
| **Database Resilience** | Native connection pooling (`pg.Pool`) with automatic embedded PostgreSQL (`@electric-sql/pglite`) fallback when running offline or in lightweight CI environments. |

---

## 📂 Repository Architecture

```text
tixora/
├── apps/
│   ├── api/                  # Express.js + TypeScript Modular Monolith Backend
│   │   ├── src/
│   │   │   ├── modules/      # 15 Bounded Domain Modules (identity, catalog, reservations, etc.)
│   │   │   ├── db/           # PostgreSQL Migrations & Seeding
│   │   │   └── common/       # Zod schemas, OpenAPI spec, JWT helpers, Logger
│   │   └── Dockerfile        # Container image for Backend API
│   │
│   └── web/                  # Next.js 14 App Router Frontend
│       ├── src/
│       │   ├── app/          # Customer, Manager, and Admin routes
│       │   ├── components/   # SeatGrid, TrailerModal, QRCard, DemoSwitcher
│       │   └── lib/          # API client with auto-proxy rewrites
│       └── Dockerfile        # Container image for Next.js Web
│
├── docs/                     # Comprehensive Engineering Guides & Interview Prep
│   ├── interview-guide.md    # Complete Interview Guide & Deep-Dive Talking Points
│   ├── secrets-guide.md      # Live credentials & provider setup guide
│   ├── architecture.md       # Architectural blueprints & domain models
│   ├── booking-lifecycle.md  # Concurrency & seat hold state machine
│   └── database-schema.md    # 21 PostgreSQL production tables & ER diagram
│
├── docker-compose.yml        # Orchestrates PostgreSQL 16 + API + Web containers
└── package.json              # Monorepo workspaces runner
```

---

## ⚡ Quick Start

### 1. Install & Test
```bash
npm install
npm test
```
*Executes all 8 integration tests covering user registration, authentication, concurrent seat competition (20 simultaneous requests on seat D6), and late payment reconciliation.*

### 2. Run Locally
```bash
# Terminal 1: Backend Express API (http://localhost:8080)
npm run dev:api

# Terminal 2: Frontend Web App (http://localhost:3000)
npm run dev:web
```

### 3. Run with Docker Compose
```bash
docker-compose up --build
```

---

## 🔑 Demo Accounts (Password: `Tixora@2026`)

The web app includes an **Instant 1-Click Demo Switcher** bar at the top:
- **Customer**: `aarav@tixora.cinema`
- **Cinema Manager (Mumbai)**: `manager@tixora.cinema`
- **Cinema Manager (New Delhi)**: `delhi.manager@tixora.cinema`
- **Cinema Gate Staff (Mumbai)**: `staff@tixora.cinema`
- **Platform Super-Admin**: `admin@tixora.cinema`

---

## 📚 Interview & Engineering Guides
- [Interview Guide & Technical Deep-Dive](docs/interview-guide.md)
- [Secrets, Production Keys & Razorpay Guide](docs/secrets-guide.md)
- [Concurrency-Safe Booking Lifecycle](docs/booking-lifecycle.md)
- [Database Schema & ER Diagrams](docs/database-schema.md)
- [REST API Contracts](docs/api-contracts.md)
