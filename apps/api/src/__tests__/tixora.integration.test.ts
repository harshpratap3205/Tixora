import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { DEMO_IDS } from '../db/seed';
import { paymentsService } from '../modules/payments/payments.module';

describe('Tixora V1 — Comprehensive Integration & Concurrency Test Suite', () => {
  let app: Express;
  let customerToken: string;
  let secondCustomerToken: string;
  let mumbaiManagerToken: string;
  let delhiManagerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp({ seed: true });
  });

  it('1. Health & Readiness probe returns UP and connected database', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.database).toBe('CONNECTED');
  });

  it('2. Authentication: Register new customer, login demo accounts, rotate refresh token', async () => {
    // Register a brand new customer
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'newcustomer@tixora.cinema',
      password: 'StrongPassword@123',
      fullName: 'Naina Talwar',
      preferredCity: 'Mumbai',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.data.accessToken).toBeDefined();
    secondCustomerToken = regRes.body.data.accessToken;

    // Login seeded customer
    const loginCustomer = await request(app).post('/api/v1/auth/login').send({
      email: 'aarav@tixora.cinema',
      password: 'Tixora@2026',
    });
    expect(loginCustomer.status).toBe(200);
    customerToken = loginCustomer.body.data.accessToken;

    // Rotate refresh token
    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: loginCustomer.body.data.refreshToken,
    });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    customerToken = refreshRes.body.data.accessToken;

    // Old refresh token must now be revoked (replay protection)
    const replayRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: loginCustomer.body.data.refreshToken,
    });
    expect(replayRes.status).toBe(401);

    // Login Mumbai Manager, Delhi Manager, and Platform Admin
    const mumbaiLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'manager@tixora.cinema',
      password: 'Tixora@2026',
    });
    mumbaiManagerToken = mumbaiLogin.body.data.accessToken;

    const delhiLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'delhi.manager@tixora.cinema',
      password: 'Tixora@2026',
    });
    delhiManagerToken = delhiLogin.body.data.accessToken;

    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@tixora.cinema',
      password: 'Tixora@2026',
    });
    adminToken = adminLogin.body.data.accessToken;
  });

  it('3. Role & Cinema-Scoped Authorization: Delhi Manager cannot modify Mumbai Cinema or its screens', async () => {
    // Delhi manager attempts to update Mumbai cinema
    const forbiddenRes = await request(app)
      .patch(`/api/v1/manager/cinemas/${DEMO_IDS.cinemas.lumiereMumbai}`)
      .set('Authorization', `Bearer ${delhiManagerToken}`)
      .send({ name: 'Unauthorized Rename' });
    expect(forbiddenRes.status).toBe(403);

    // Mumbai manager updates their own Mumbai cinema -> 200 OK
    const allowedRes = await request(app)
      .patch(`/api/v1/manager/cinemas/${DEMO_IDS.cinemas.lumiereMumbai}`)
      .set('Authorization', `Bearer ${mumbaiManagerToken}`)
      .send({ neighborhood: 'Lower Parel Luxury District' });
    expect(allowedRes.status).toBe(200);
    expect(allowedRes.body.data.neighborhood).toBe('Lower Parel Luxury District');
  });

  it('4. Showtime Scheduling: Rejects overlapping showtimes on the same screen including turnaround time', async () => {
    // Get existing show1 details to know its start_time
    const show1Res = await request(app).get(`/api/v1/shows/${DEMO_IDS.shows.show1}`);
    expect(show1Res.status).toBe(200);
    const startTime = new Date(show1Res.body.data.startTime);

    // Attempt to schedule another show 30 minutes after show1 starts on the same screen
    const overlappingStart = new Date(startTime.getTime() + 30 * 60 * 1000).toISOString();
    const conflictRes = await request(app)
      .post('/api/v1/manager/shows')
      .set('Authorization', `Bearer ${mumbaiManagerToken}`)
      .send({
        movieId: DEMO_IDS.movies.velvetNoir,
        cinemaId: DEMO_IDS.cinemas.lumiereMumbai,
        screenId: DEMO_IDS.screens.lumiereImax,
        language: 'English',
        format: 'IMAX 2D',
        startTime: overlappingStart,
        categoryPrices: { STANDARD: 400, PRIME: 550, RECLINER: 900 },
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe('CONFLICT');
  });

  it('5. Concurrent Seat Reservation: 20 simultaneous requests competing for the exact same seat (D6) result in exactly 1 winner and 19 HTTP 409 Conflicts', async () => {
    const competingRequests = Array.from({ length: 20 }, (_, i) =>
      request(app)
        .post('/api/v1/seat-holds')
        .set('Authorization', `Bearer ${i % 2 === 0 ? customerToken : secondCustomerToken}`)
        .send({
          showId: DEMO_IDS.shows.show1,
          seatCodes: ['D6'],
        })
    );

    const responses = await Promise.all(competingRequests);
    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(19);
  });

  it('6. Multi-Seat Atomic Reservation: All-or-nothing semantics when one of the requested seats is already HELD', async () => {
    // D6 is already HELD from test 5. Requesting [D5, D6, D7] must fail with 409 and leave D5 & D7 AVAILABLE.
    const atomicFailRes = await request(app)
      .post('/api/v1/seat-holds')
      .set('Authorization', `Bearer ${secondCustomerToken}`)
      .send({
        showId: DEMO_IDS.shows.show1,
        seatCodes: ['D5', 'D6', 'D7'],
      });
    expect(atomicFailRes.status).toBe(409);

    // Verify D5 and D7 are still AVAILABLE and can be held together
    const atomicSuccessRes = await request(app)
      .post('/api/v1/seat-holds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        showId: DEMO_IDS.shows.show1,
        seatCodes: ['D5', 'D7'],
      });
    expect(atomicSuccessRes.status).toBe(201);
    expect(atomicSuccessRes.body.data.seats.map((s: any) => s.seatCode)).toEqual(['D5', 'D7']);
  });

  it('7. Complete Booking, Idempotency, Signed Payment Webhook & Cryptographic QR Ticket Check-in Lifecycle', async () => {
    // Hold seats E4, E5 on Show 2
    const holdRes = await request(app)
      .post('/api/v1/seat-holds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        showId: DEMO_IDS.shows.show2,
        seatCodes: ['E4', 'E5'],
      });
    expect(holdRes.status).toBe(201);
    const holdId = holdRes.body.data.id;

    // Create booking with idempotency key
    const bookingRes1 = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        holdId,
        idempotencyKey: 'idem_booking_e4_e5_test',
      });
    expect(bookingRes1.status).toBe(201);
    const bookingId = bookingRes1.body.data.id;

    // Duplicate booking request with same idempotency key returns identical booking without error
    const bookingRes2 = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        holdId,
        idempotencyKey: 'idem_booking_e4_e5_test',
      });
    expect(bookingRes2.status).toBe(201);
    expect(bookingRes2.body.data.id).toBe(bookingId);

    // Initiate Payment Intent
    const paymentRes = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingId,
        idempotencyKey: 'idem_payment_e4_e5_test',
      });
    expect(paymentRes.status).toBe(201);
    const providerIntentId = paymentRes.body.data.providerIntentId;

    // Attempt webhook with forged signature -> 401 Unauthorized
    const webhookPayload = {
      eventId: 'evt_valid_payment_001',
      eventType: 'payment.succeeded' as const,
      providerIntentId,
    };
    const badWebhookRes = await request(app)
      .post('/api/v1/payments/webhooks/tixora_sandbox')
      .set('x-tixora-signature', 'invalid_signature')
      .send(webhookPayload);
    expect(badWebhookRes.status).toBe(401);

    // Send properly signed webhook -> confirms booking & generates QR ticket
    const validSignature = paymentsService.computeWebhookSignature(
      JSON.stringify(webhookPayload)
    );
    const goodWebhookRes = await request(app)
      .post('/api/v1/payments/webhooks/tixora_sandbox')
      .set('x-tixora-signature', validSignature)
      .send(webhookPayload);
    expect(goodWebhookRes.status).toBe(200);
    expect(goodWebhookRes.body.data.bookingStatus).toBe('CONFIRMED');
    expect(goodWebhookRes.body.data.ticketCode).toBeDefined();

    // Replay the exact same webhook -> processed idempotently
    const replayWebhookRes = await request(app)
      .post('/api/v1/payments/webhooks/tixora_sandbox')
      .set('x-tixora-signature', validSignature)
      .send(webhookPayload);
    expect(replayWebhookRes.status).toBe(200);
    expect(replayWebhookRes.body.data.idempotentReplay).toBe(true);

    // Retrieve QR Ticket
    const ticketRes = await request(app)
      .get(`/api/v1/bookings/${bookingId}/ticket`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(ticketRes.status).toBe(200);
    const qrToken = ticketRes.body.data.qrToken;
    expect(qrToken).toMatch(/^TXQR\./);

    // Validate QR Ticket at cinema gate (first scan -> 200 OK)
    const checkIn1 = await request(app)
      .post('/api/v1/manager/tickets/validate')
      .set('Authorization', `Bearer ${mumbaiManagerToken}`)
      .send({ qrTokenOrCode: qrToken });
    expect(checkIn1.status).toBe(200);
    expect(checkIn1.body.data.status).toBe('CHECKED_IN');

    // Second scan of the same QR Ticket -> 409 Conflict (Duplicate check-in prevented)
    const checkIn2 = await request(app)
      .post('/api/v1/manager/tickets/validate')
      .set('Authorization', `Bearer ${mumbaiManagerToken}`)
      .send({ qrTokenOrCode: qrToken });
    expect(checkIn2.status).toBe(409);
  });

  it('8. Late Payment Reconciliation: When hold expires and another customer claims the seat, late payment never double-books and enters REFUND_REQUIRED', async () => {
    // Customer 1 holds seat F8 with a short 5-second hold
    const hold1 = await request(app)
      .post('/api/v1/seat-holds')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        showId: DEMO_IDS.shows.show3,
        seatCodes: ['F8'],
        holdDurationSeconds: 5,
      });
    expect(hold1.status).toBe(201);

    const booking1 = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        holdId: hold1.body.data.id,
        idempotencyKey: 'idem_late_payment_booking_1',
      });
    expect(booking1.status).toBe(201);

    const payment1 = await request(app)
      .post('/api/v1/payments/intents')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        bookingId: booking1.body.data.id,
        idempotencyKey: 'idem_late_payment_intent_1',
      });
    expect(payment1.status).toBe(201);

    // Wait 5.5 seconds for Customer 1's hold to expire
    await new Promise((resolve) => setTimeout(resolve, 5500));

    // Customer 2 now claims F8 after Customer 1's hold expired
    const hold2 = await request(app)
      .post('/api/v1/seat-holds')
      .set('Authorization', `Bearer ${secondCustomerToken}`)
      .send({
        showId: DEMO_IDS.shows.show3,
        seatCodes: ['F8'],
      });
    expect(hold2.status).toBe(201);

    // Now Customer 1's payment webhook arrives late!
    const lateWebhookPayload = {
      eventId: 'evt_late_payment_999',
      eventType: 'payment.succeeded' as const,
      providerIntentId: payment1.body.data.providerIntentId,
    };
    const sig = paymentsService.computeWebhookSignature(JSON.stringify(lateWebhookPayload));

    const lateWebhookRes = await request(app)
      .post('/api/v1/payments/webhooks/tixora_sandbox')
      .set('x-tixora-signature', sig)
      .send(lateWebhookPayload);

    expect(lateWebhookRes.status).toBe(200);
    expect(lateWebhookRes.body.data.bookingStatus).toBe('REFUND_REQUIRED');
    expect(lateWebhookRes.body.data.paymentStatus).toBe('REFUND_PENDING');
  }, 15000);
});
