# 🎬 Tixora — Movie Ticket Booking Platform

> **Simple Summary**: Tixora is a full-stack movie booking platform (like BookMyShow) where users can watch movie trailers, pick cinema showtimes, select seats in real-time, pay, and get a digital ticket with a scannable QR code.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2F17-336791.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Vitest-8%20Passed-brightgreen.svg)](https://vitest.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

---

## 📌 Resume Points
- **Tech Stack**: Next.js, TypeScript, Node.js, Express.js, PostgreSQL, Docker
- **Portal Features**: Built a booking platform with customer, cinema, and admin portals for showtimes, seats, and QR tickets.
- **Backend Architecture**: Added JWT refresh sessions, Zod validation, Swagger docs, and integration tests.

---

## 🌐 Live URLs
- **Website (Frontend)**: [https://tixora.harshthedev.ccwu.cc](https://tixora.harshthedev.ccwu.cc)
- **API Backend**: [https://tixora-6j4h.onrender.com](https://tixora-6j4h.onrender.com)
- **Interactive API Docs (Swagger UI)**: [https://tixora-6j4h.onrender.com/api-docs](https://tixora-6j4h.onrender.com/api-docs)
- **Server Health Check**: [https://tixora-6j4h.onrender.com/health](https://tixora-6j4h.onrender.com/health)

---

## 👥 The 3 Portals Explained Simply

| Portal | Who Uses It | What You Can Do |
| :--- | :--- | :--- |
| **1. Customer Portal** | Regular moviegoers | • Browse movies & watch official YouTube trailers<br>• Pick city, cinema, and showtime<br>• Pick seats on an interactive seat map (Standard, Prime, Recliner, IMAX)<br>• 8-minute countdown timer holds your seats<br>• Checkout & get a digital QR ticket pass |
| **2. Cinema Manager Portal** | Theater staff & managers | • View and schedule upcoming movie shows<br>• See cinema halls and seating layouts<br>• **QR Scanner**: Scan customer tickets at the gate to verify entry and stop duplicate screenshot usage |
| **3. Admin Portal** | Platform owner | • View live platform revenue and total bookings<br>• Manage cinemas, screens, and movies<br>• View security audit logs (who booked, who cancelled, who refunded) |

---

## 🚀 How to Run Locally in 3 Steps

### Step 1: Clone and install dependencies
```bash
git clone https://github.com/harshpratap3205/Tixora.git
cd Tixora
npm install
```

### Step 2: Run the automated tests (Checks all features & concurrency)
```bash
npm test
```
*(You will see all 8 test suites pass, including testing 20 concurrent users competing for the same seat!)*

### Step 3: Start the app
```bash
# Terminal 1: Starts the API Backend on port 8080
npm run dev:api

# Terminal 2: Starts the Next.js Frontend on port 3000
npm run dev:web
```
Now open **http://localhost:3000** in your browser!

> **Note**: Tixora includes an automatic embedded PostgreSQL engine (`pglite`). You can run it immediately without manually setting up a database server!

---

## 🔑 Demo Login Accounts

All accounts share the same password: **`Tixora@2026`**  
*(You can also use the **1-Click Demo Switcher** bar at the top of the website to switch between them instantly!)*

| Role | Email | Access |
| :--- | :--- | :--- |
| **Customer** | `aarav@tixora.cinema` | Book tickets, view past bookings, see QR pass |
| **Cinema Manager (Mumbai)** | `manager@tixora.cinema` | Manage Mumbai screens, schedule shows, scan tickets |
| **Cinema Manager (Delhi)** | `delhi.manager@tixora.cinema` | Manage Delhi screens & schedule shows |
| **Cinema Gate Staff** | `staff@tixora.cinema` | Scan QR tickets at the gate |
| **Platform Admin** | `admin@tixora.cinema` | Full platform dashboard, analytics, and audit logs |

---

## 💡 How Key Features Work (Interview Talking Points)

### 1. How do you stop two people from booking the same seat?
> We use PostgreSQL **`SELECT ... FOR UPDATE`** row locking with sorted seat codes. When a user selects seats, the database locks those exact rows. If 20 people click the same seat at the exact same millisecond, the first person gets the 8-minute lock, and the other 19 immediately get a clear message that the seat is already taken (`HTTP 409 Conflict`). Deadlocks are impossible because seat codes are locked in alphabetical order (`A1`, `A2`, `A3`).

### 2. How does login and security work?
> We use **JWT (JSON Web Tokens)**:
> - **Access Token**: Short-lived (15 minutes) for fast, secure API calls.
> - **Refresh Token**: Long-lived (7 days) stored as a secure hash in the database. When the access token expires, the client uses the refresh token to get a new one automatically without asking the user to log in again. If a stolen token is reused, the session is cancelled immediately.

### 3. How does ticket verification work at the theater gate?
> Every confirmed ticket generates a unique **cryptographic QR token (`TXQR...`)** signed with HMAC-SHA256. At the cinema gate, the manager uses the built-in scanner. The server checks the cryptographic signature and marks the ticket as `CHECKED_IN`. If someone tries to scan a screenshot of an already-used ticket, the scanner rejects it with a red warning: **"Duplicate Ticket - Already Checked In"**.

### 4. What happens if payment is delayed?
> If a customer's 8-minute hold expires while they are paying and someone else takes the seat, our webhook handler detects this conflict. It **never double-books the seat**. Instead, it automatically flags the booking as `REFUND_REQUIRED` so the customer's money is safely refunded.

---

## 📁 Project Folder Structure

```text
TIXORA/
├── apps/
│   ├── api/                  # Backend (Node.js, Express, TypeScript, PostgreSQL)
│   │   ├── src/
│   │   │   ├── modules/      # 15 clean business modules (auth, movies, booking, payments, etc.)
│   │   │   ├── db/           # Database schema migrations & demo seeds
│   │   │   └── common/       # Zod validation schemas & Swagger docs
│   │   └── Dockerfile
│   │
│   └── web/                  # Frontend (Next.js 14 App Router, Tailwind CSS)
│       ├── src/
│       │   ├── app/          # Pages for Customer, Manager, and Admin
│       │   ├── components/   # Seat grid, trailer player, QR ticket modal
│       │   └── lib/          # API helper
│       └── Dockerfile
│
├── docs/                     # Detailed guides
│   ├── interview-guide.md    # Complete Q&A and technical deep-dive
│   ├── secrets-guide.md      # How to set up real Razorpay/Stripe keys
│   └── database-schema.md    # 21 database tables explained
│
├── docker-compose.yml        # Run the entire app with 1 command in Docker
└── package.json
```

---

## 🐳 Running with Docker

If you have Docker installed, you can start the entire stack (Database + API + Frontend) with one command:
```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- API Backend: `http://localhost:8080`
- Swagger Docs: `http://localhost:8080/api-docs`

---

## 📄 License
This project is open-source and available for educational and portfolio demonstration.
