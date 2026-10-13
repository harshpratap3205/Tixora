# Tixora V1 — Secrets, Credentials & Production Integration Guide

This guide explains **every single environment variable and secret key** used in Tixora, showing where they are defined, where the current values live, and **how to swap mock/sandbox values for real production providers** (PostgreSQL, live Stripe/Razorpay payment gateway, production JWT secrets, and SMTP email services).

---

## 1. Where Environment Variables Are Configured

- **Backend Configuration File**: [`apps/api/.env`](file:///c:/Users/harsh/Downloads/avtar-portfolio/Projects/TIXORA/apps/api/.env)
- **Monorepo Example Template**: [`.env.example`](file:///c:/Users/harsh/Downloads/avtar-portfolio/Projects/TIXORA/.env.example)
- **Central TypeScript Config**: [`apps/api/src/common/config.ts`](file:///c:/Users/harsh/Downloads/avtar-portfolio/Projects/TIXORA/apps/api/src/common/config.ts)

---

## 2. Complete Inventory of Variables & Secrets

### A. Database Connection
| Variable | Current Value | What It Does | How to Replace with Real Production |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://tixora:3205@localhost:5432/tixora` | Full JDBC/PostgreSQL connection string | Replace with your managed database URL (e.g. AWS RDS, Supabase, Neon): `postgresql://user:password@db.xyz.supabase.co:5432/tixora?sslmode=require` |
| `POSTGRES_HOST` | `localhost` | Database host | Hostname or IP of your PostgreSQL instance |
| `POSTGRES_PORT` | `5432` | Database port | Standard PostgreSQL port is `5432` |
| `POSTGRES_DB` | `tixora` | Database name | Name of your database |
| `POSTGRES_USER` | `tixora` | Database username | Production database username |
| `POSTGRES_PASSWORD` | `3205` | Database password | Strong production password (e.g., 32+ random characters) |

---

### B. Authentication & Cryptography Secrets
| Variable | Current Value | What It Does | How to Replace with Real Production |
| :--- | :--- | :--- | :--- |
| `JWT_ACCESS_SECRET` | `tixora_v1_production_grade_hmac_sha256_access_secret_key_2026` | Secret key used to sign and verify short-lived JWT access tokens | Generate a cryptographically secure 256-bit or 512-bit random string: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | `tixora_v1_production_grade_hmac_sha256_refresh_secret_key_2026` | Secret key used in session token hashing and verification | Generate a cryptographically secure random string with 64+ bytes |
| `JWT_ACCESS_EXPIRY` | `15m` | Lifetime of an access token | Keep at `15m` (15 minutes) for industry-standard token security |
| `JWT_REFRESH_EXPIRY_DAYS` | `7` | Duration of refresh sessions in the database | `7` days (or `30` days based on product requirements) |
| `QR_SIGNING_SECRET` | `tixora_v1_qr_ticket_hmac_sha256_verification_secret_key_2026` | **HMAC-SHA256 secret** used to sign `TXQR...` gate passes | Generate a dedicated random key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never expose this key publicly! |

---

### C. Reservation & Business Logic Settings
| Variable | Current Value | What It Does | Tuning Guidance |
| :--- | :--- | :--- | :--- |
| `HOLD_DURATION_SECONDS` | `480` | Number of seconds a seat hold remains valid (480s = 8 minutes) | Can be tuned to `300` (5 mins) or `600` (10 mins) depending on traffic |
| `TURNAROUND_MINUTES` | `20` | Cleaning / maintenance interval between consecutive screenings on a screen | Can be tuned to 15–30 minutes based on cinema turnaround policies |

---

### D. Payment Gateway Integration
| Variable | Current Value | What It Does | How to Replace with Real Payment Providers |
| :--- | :--- | :--- | :--- |
| `PAYMENT_PROVIDER` | `mock` / `TIXORA_SANDBOX` | Identifies which payment adapter is active | Change to `stripe`, `razorpay`, or `tixora_sandbox` |
| `PAYMENT_WEBHOOK_SECRET` | `whsec_tixora_sandbox_signature_secret_2026` | Secret key used to verify the incoming `x-tixora-signature` header on webhooks | When using Stripe, replace with your Stripe Webhook Signing Secret (`whsec_...` from the Stripe Dashboard). When using Razorpay, replace with your Razorpay webhook secret. |

---

### E. Frontend & URLs
| Variable | Current Value | What It Does | Production Setting |
| :--- | :--- | :--- | :--- |
| `PORT` | `8080` | Backend Express listening port | In production containers, keep `8080` or use `process.env.PORT` |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin for browser requests | Set to your live production domain: `https://tixora.yourdomain.com` |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080/api/v1` | URL the Next.js frontend calls to communicate with the API | Set to `https://api.tixora.yourdomain.com/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Frontend web application origin | Set to `https://tixora.yourdomain.com` |

---

## 3. How to Plug in Live Payment Gateways

### Example: Switching from Sandbox to Stripe
1. In `apps/api/.env`, update:
   ```env
   PAYMENT_PROVIDER=stripe
   STRIPE_SECRET_KEY=sk_live_51...
   STRIPE_PUBLISHABLE_KEY=pk_live_51...
   PAYMENT_WEBHOOK_SECRET=whsec_...
   ```
2. In [`apps/api/src/modules/payments/payments.module.ts`](file:///c:/Users/harsh/Downloads/avtar-portfolio/Projects/TIXORA/apps/api/src/modules/payments/payments.module.ts#L43-L57):
   The webhook signature verification method uses standard HMAC-SHA256 signature checking:
   ```typescript
   export class PaymentsService {
     public computeWebhookSignature(rawBody: string): string {
       return crypto
         .createHmac('sha256', config.payment.webhookSecret)
         .update(rawBody)
         .digest('hex');
     }
   ```
   If using Stripe's native SDK, you can directly use `stripe.webhooks.constructEvent(rawBody, sigHeader, secret)`.

### Example: Switching to Razorpay
1. In `apps/api/.env`, add:
   ```env
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_live_...
   RAZORPAY_KEY_SECRET=your_secret
   PAYMENT_WEBHOOK_SECRET=your_razorpay_webhook_secret
   ```
2. Razorpay webhooks use the exact same HMAC-SHA256 digest on the request body using `RAZORPAY_WEBHOOK_SECRET` and compare it against `req.headers['x-razorpay-signature']`.

