# Tixora V1 — Authentication, Session Rotation & Scoped RBAC

## 1. Password & Token Security
- Passwords are hashed using `bcryptjs` (cost factor 10).
- Access tokens are short-lived `HMAC-SHA256` signed JWTs carrying user ID, roles, and `managedCinemaIds`.
- Refresh tokens are 48-byte cryptographically random tokens stored only as `SHA-256` hashes in `refresh_sessions`.
- **Refresh Token Rotation**: Calling `POST /api/v1/auth/refresh` revokes the used session (`revoked_at = NOW()`), links `replaced_by_session_id`, and issues a fresh token pair. Replaying an already-rotated token immediately fails with `401 Unauthorized`.

## 2. Role Model & Cinema-Scoped Authorization
Tixora enforces four roles:
1. `CUSTOMER` — Can hold seats, create bookings, pay, and view/cancel their own tickets.
2. `CINEMA_STAFF` — Can validate QR tickets at gates for cinemas assigned in `cinema_staff`.
3. `CINEMA_MANAGER` — Can manage screens, seat layouts, showtimes, pricing, and reports **only for cinemas assigned in `cinema_staff`**.
4. `PLATFORM_ADMIN` — Global governance over catalog, cinema onboarding, users, payments, and audit logs.

`assertCinemaAccess(req.user, cinemaId)` is enforced on the backend for every manager/staff operation. Attempting to modify or validate another cinema's resources returns `HTTP 403 FORBIDDEN`.

