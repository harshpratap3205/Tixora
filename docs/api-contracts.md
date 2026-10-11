# Tixora V1 — REST API Contracts (`/api/v1`)

Interactive OpenAPI 3.0 / Swagger documentation is served live at `http://localhost:8080/api-docs` and raw JSON at `http://localhost:8080/api/v1/openapi.json`.

## 1. Authentication & Users
- `POST /api/v1/auth/register` — Register customer account (`201 Created`)
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token + rotating refresh token (`200 OK`)
- `POST /api/v1/auth/refresh` — Rotate refresh session (`200 OK`, `401 Unauthorized` on replay)
- `POST /api/v1/auth/logout` — Revoke refresh session (`200 OK`)
- `GET /api/v1/users/me` — Current user profile, roles, and scoped cinemas (`200 OK`)
- `PATCH /api/v1/users/me` — Update profile and preferred city (`200 OK`)
- `GET /api/v1/users/me/bookings` — Customer booking history and QR tickets (`200 OK`)

## 2. Catalog, Cinemas & Showtimes
- `GET /api/v1/movies` — Filter by `search`, `language`, `genre`, `status`, `sort`, `page`, `limit` (`200 OK`)
- `GET /api/v1/movies/:id` — Movie details by UUID or slug (`200 OK`)
- `GET /api/v1/movies/:id/shows` — Published showtimes for movie (`200 OK`)
- `GET /api/v1/cities` — Active cities with cinema counts (`200 OK`)
- `GET /api/v1/cinemas` — Filter cinemas by `city` and `search` (`200 OK`)
- `GET /api/v1/cinemas/:id` — Cinema details, screens, and showtimes (`200 OK`)
- `GET /api/v1/shows/:id` — Showtime metadata (`200 OK`)
- `GET /api/v1/shows/:id/seats` — Real-time seat layout & availability (`200 OK`)

## 3. Concurrency-Safe Seat Holds & Bookings
- `POST /api/v1/seat-holds` — Atomically lock seats (`201 Created`, `409 Conflict` if any seat unavailable)
- `GET /api/v1/seat-holds/:id` — Get hold status and `expiresAt` (`200 OK`)
- `DELETE /api/v1/seat-holds/:id` — Release hold immediately (`200 OK`)
- `POST /api/v1/bookings` — Create idempotent pending-payment booking (`201 Created`)
- `GET /api/v1/bookings/:id` — Booking details, seats, and payment attempts (`200 OK`)
- `GET /api/v1/bookings/:id/status` — Lightweight booking status check (`200 OK`)
- `GET /api/v1/bookings/:id/ticket` — Retrieve cryptographic QR ticket (`200 OK`)
- `POST /api/v1/bookings/:id/cancel` — Cancel booking, release seats, void ticket, refund payment (`200 OK`)

## 4. Payments & Signed Webhooks
- `POST /api/v1/payments/intents` — Create sandbox payment intent (`201 Created`)
- `GET /api/v1/payments/:id` — Retrieve payment status (`200 OK`)
- `POST /api/v1/payments/webhooks/:provider` — Verify `x-tixora-signature` HMAC-SHA256 header and process webhook idempotently (`200 OK`)

## 5. Cinema Manager Portal (`/api/v1/manager`)
- `GET /api/v1/manager/cinemas` — List cinemas scoped to manager
- `POST /api/v1/manager/cinemas` — Create cinema
- `PATCH /api/v1/manager/cinemas/:id` — Update scoped cinema (`403 Forbidden` if unauthorized cinema)
- `POST /api/v1/manager/cinemas/:id/screens` — Create screen and generate physical seat grid
- `PUT /api/v1/manager/screens/:id/seats` — Update seat layout (protects held/booked seats)
- `POST /api/v1/manager/shows` — Schedule showtime (enforces overlap + turnaround validation)
- `PUT /api/v1/manager/shows/:id/pricing` — Update category prices for available seats
- `GET /api/v1/manager/bookings` — Scoped bookings ledger
- `POST /api/v1/manager/tickets/validate` — Verify cryptographic QR ticket and record check-in (`409 Conflict` on duplicate check-in)
- `GET /api/v1/manager/reports/occupancy` & `GET /api/v1/manager/reports/revenue`

## 6. Platform Admin Console (`/api/v1/admin`)
- `POST /api/v1/admin/movies` & `PATCH /api/v1/admin/movies/:id`
- `POST /api/v1/admin/cinemas` & `PATCH /api/v1/admin/cinemas/:id`
- `GET /api/v1/admin/users` & `PATCH /api/v1/admin/users/:id/status`
- `GET /api/v1/admin/bookings`, `GET /api/v1/admin/payments`, `GET /api/v1/admin/audit-logs`, `GET /api/v1/admin/reports/overview`

