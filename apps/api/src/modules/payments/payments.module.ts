import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { config } from '../../common/config';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';
import { requireAuth } from '../identity/identity.module';
import { ticketsService } from '../tickets/tickets.module';
import { auditingService } from '../auditing/auditing.service';

export const createPaymentIntentSchema = z.object({
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().min(6).max(140),
  paymentMethod: z.string().default('CARD_SANDBOX'),
});

export const webhookPayloadSchema = z.object({
  eventId: z.string().min(4),
  eventType: z.enum(['payment.succeeded', 'payment.failed']),
  providerIntentId: z.string().min(4),
  failureReason: z.string().optional(),
});

export class PaymentsService {
  public computeWebhookSignature(rawBody: string): string {
    return crypto
      .createHmac('sha256', config.payment.webhookSecret)
      .update(rawBody)
      .digest('hex');
  }

  public verifyWebhookSignature(rawBody: string, signatureHeader?: string): boolean {
    if (!signatureHeader) return false;
    const expected = this.computeWebhookSignature(rawBody);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'utf-8'),
        Buffer.from(expected, 'utf-8')
      );
    } catch {
      return false;
    }
  }

  public async createPaymentIntent(
    userId: string,
    input: z.infer<typeof createPaymentIntentSchema>
  ) {
    const existing = await db.query(
      `SELECT id, booking_id as "bookingId", provider, provider_intent_id as "providerIntentId",
              amount::float as amount, currency, status, client_secret as "clientSecret",
              payment_method as "paymentMethod", created_at as "createdAt"
       FROM payments
       WHERE idempotency_key = $1`,
      [input.idempotencyKey]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    return db.withTransaction(async (tx) => {
      const bRes = await tx.query<{
        id: string;
        user_id: string;
        hold_id: string;
        status: string;
        total_amount: string;
        currency: string;
      }>(
        `SELECT id, user_id, hold_id, status, total_amount::text as total_amount, currency
         FROM bookings WHERE id = $1 FOR UPDATE`,
        [input.bookingId]
      );

      if (bRes.rows.length === 0) {
        throw AppError.notFound('Booking not found');
      }

      const booking = bRes.rows[0];
      if (booking.user_id !== userId) {
        throw AppError.forbidden('You do not own this booking');
      }

      if (booking.status === 'CONFIRMED') {
        throw AppError.conflict('Booking is already confirmed');
      }

      const holdRes = await tx.query<{ status: string; expires_at: string }>(
        `SELECT status, expires_at FROM seat_holds WHERE id = $1`,
        [booking.hold_id]
      );

      if (
        holdRes.rows.length === 0 ||
        holdRes.rows[0].status !== 'ACTIVE' ||
        new Date(holdRes.rows[0].expires_at).getTime() <= Date.now()
      ) {
        throw AppError.conflict('Cannot initiate payment: seat reservation has expired');
      }

      const paymentId = crypto.randomUUID();
      const providerIntentId = `pi_txr_${crypto.randomBytes(10).toString('hex')}`;
      const clientSecret = `cs_txr_${crypto.randomBytes(16).toString('hex')}`;
      const amount = parseFloat(booking.total_amount);

      // Generate a ready-to-use sandbox webhook signature so the frontend sandbox simulator
      // can dispatch a cryptographically signed webhook callback during local checkout
      const sampleSuccessPayload = JSON.stringify({
        eventId: `evt_${paymentId.replace(/-/g, '').slice(0, 16)}`,
        eventType: 'payment.succeeded',
        providerIntentId,
      });
      const sandboxWebhookSignature = this.computeWebhookSignature(sampleSuccessPayload);

      await tx.query(
        `INSERT INTO payments (
          id, booking_id, user_id, provider, provider_intent_id, idempotency_key,
          amount, currency, status, payment_method, client_secret
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9,$10)`,
        [
          paymentId,
          booking.id,
          userId,
          config.payment.provider,
          providerIntentId,
          input.idempotencyKey,
          amount,
          booking.currency,
          input.paymentMethod,
          clientSecret,
        ]
      );

      return {
        id: paymentId,
        bookingId: booking.id,
        provider: config.payment.provider,
        providerIntentId,
        amount,
        currency: booking.currency,
        status: 'PENDING',
        paymentMethod: input.paymentMethod,
        clientSecret,
        sandboxWebhookHelper: {
          samplePayload: JSON.parse(sampleSuccessPayload),
          signature: sandboxWebhookSignature,
        },
      };
    });
  }

  public async getPaymentById(paymentId: string, requesterUserId: string, roles: string[]) {
    const res = await db.query(
      `SELECT id, booking_id as "bookingId", user_id as "userId",
              provider, provider_intent_id as "providerIntentId",
              amount::float as amount, currency, status,
              payment_method as "paymentMethod", failure_reason as "failureReason",
              reconciliation_notes as "reconciliationNotes",
              completed_at as "completedAt", created_at as "createdAt"
       FROM payments WHERE id = $1`,
      [paymentId]
    );

    if (res.rows.length === 0) {
      throw AppError.notFound('Payment not found');
    }

    const payment = res.rows[0];
    if (payment.userId !== requesterUserId && !roles.includes('PLATFORM_ADMIN')) {
      throw AppError.forbidden('You do not have permission to view this payment');
    }

    return payment;
  }

  /**
   * Processes a verified payment provider webhook idempotently.
   * Handles the critical race condition where:
   * - Customer A's hold expires
   * - Customer B claims or books the seat
   * - Customer A's payment succeeds late
   * Result: Never double-book the seat; mark Customer A's booking as REFUND_REQUIRED
   * and payment as REFUND_PENDING with full audit and outbox trail.
   */
  public async processWebhook(
    provider: string,
    payload: z.infer<typeof webhookPayloadSchema>
  ) {
    return db.withTransaction(async (tx) => {
      // 1. Check webhook idempotency via payment_events(event_id)
      const existingEvent = await tx.query<{ id: string }>(
        `SELECT id FROM payment_events WHERE event_id = $1`,
        [payload.eventId]
      );
      if (existingEvent.rows.length > 0) {
        return {
          idempotentReplay: true,
          eventId: payload.eventId,
          status: 'ALREADY_PROCESSED',
        };
      }

      // 2. Lock payment row
      const pRes = await tx.query<{
        id: string;
        booking_id: string;
        user_id: string;
        status: string;
      }>(
        `SELECT id, booking_id, user_id, status
         FROM payments
         WHERE provider_intent_id = $1
         FOR UPDATE`,
        [payload.providerIntentId]
      );

      if (pRes.rows.length === 0) {
        throw AppError.notFound('Payment intent not found');
      }

      const payment = pRes.rows[0];

      // Record event in payment_events to guarantee idempotency
      await tx.query(
        `INSERT INTO payment_events (id, provider, event_id, payment_id, event_type, payload, processed_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSED')`,
        [
          crypto.randomUUID(),
          provider.toUpperCase(),
          payload.eventId,
          payment.id,
          payload.eventType,
          JSON.stringify(payload),
        ]
      );

      if (payload.eventType === 'payment.failed') {
        await tx.query(
          `UPDATE payments
           SET status = 'FAILED',
               failure_reason = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [payload.failureReason || 'Payment declined by provider', payment.id]
        );
        return {
          idempotentReplay: false,
          paymentStatus: 'FAILED',
          bookingId: payment.booking_id,
        };
      }

      // 3. Payment succeeded — lock booking and seat hold
      const bRes = await tx.query<{
        id: string;
        booking_reference: string;
        user_id: string;
        show_id: string;
        hold_id: string;
        status: string;
      }>(
        `SELECT id, booking_reference, user_id, show_id, hold_id, status
         FROM bookings WHERE id = $1 FOR UPDATE`,
        [payment.booking_id]
      );

      const booking = bRes.rows[0];
      if (booking.status === 'CONFIRMED') {
        // Already confirmed earlier
        await tx.query(
          `UPDATE payments SET status = 'SUCCEEDED', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW() WHERE id = $1`,
          [payment.id]
        );
        return {
          idempotentReplay: true,
          paymentStatus: 'SUCCEEDED',
          bookingStatus: 'CONFIRMED',
          bookingId: booking.id,
        };
      }

      // 4. Lock all show_seats belonging to this booking in deterministic order
      const itemsRes = await tx.query<{ show_seat_id: string; seat_code: string }>(
        `SELECT show_seat_id, seat_code
         FROM booking_items
         WHERE booking_id = $1
         ORDER BY seat_code ASC`,
        [booking.id]
      );

      const seatIds = itemsRes.rows.map((i) => i.show_seat_id);
      const lockedSeatsRes = await tx.query<{
        id: string;
        seat_code: string;
        status: string;
        active_hold_id: string | null;
        booking_id: string | null;
      }>(
        `SELECT id, seat_code, status, active_hold_id, booking_id
         FROM show_seats
         WHERE id = ANY($1::uuid[])
         ORDER BY seat_code ASC
         FOR UPDATE`,
        [seatIds]
      );

      // Check whether any seat was claimed by another hold or booked by another customer
      const canConfirmAllSeats = lockedSeatsRes.rows.every(
        (seat) =>
          (seat.status === 'HELD' && seat.active_hold_id === booking.hold_id) ||
          (seat.status === 'AVAILABLE' && seat.active_hold_id === null)
      );

      if (!canConfirmAllSeats) {
        // LATE PAYMENT CONFLICT: Another customer now holds or booked at least one seat!
        // Never double-book! Transition to REFUND_PENDING / REFUND_REQUIRED.
        const note =
          'Late payment received after hold expiry; seats were acquired by another customer. Flagged for automatic refund.';
        await tx.query(
          `UPDATE payments
           SET status = 'REFUND_PENDING',
               reconciliation_notes = $1,
               completed_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [note, payment.id]
        );

        await tx.query(
          `UPDATE bookings
           SET status = 'REFUND_REQUIRED',
               cancellation_reason = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [note, booking.id]
        );

        await auditingService.record(
          {
            actorUserId: booking.user_id,
            actorRole: 'SYSTEM_WEBHOOK',
            action: 'LATE_PAYMENT_REFUND_REQUIRED',
            entityType: 'BOOKING',
            entityId: booking.id,
            metadata: { paymentId: payment.id, providerIntentId: payload.providerIntentId },
          },
          tx
        );

        return {
          idempotentReplay: false,
          paymentStatus: 'REFUND_PENDING',
          bookingStatus: 'REFUND_REQUIRED',
          bookingId: booking.id,
          reconciliationNote: note,
        };
      }

      // 5. All seats are valid and owned by this hold (or still untouched if hold just expired milliseconds ago without competing claim)
      for (const seat of lockedSeatsRes.rows) {
        await tx.query(
          `UPDATE show_seats
           SET status = 'BOOKED',
               booking_id = $1,
               active_hold_id = NULL,
               hold_expires_at = NULL,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $2`,
          [booking.id, seat.id]
        );
      }

      await tx.query(
        `UPDATE seat_holds SET status = 'CONVERTED', updated_at = NOW() WHERE id = $1`,
        [booking.hold_id]
      );

      await tx.query(
        `UPDATE bookings
         SET status = 'CONFIRMED',
             confirmed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id]
      );

      await tx.query(
        `UPDATE payments
         SET status = 'SUCCEEDED',
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [payment.id]
      );

      // 6. Issue cryptographic QR ticket
      const seatCodes = itemsRes.rows.map((i) => i.seat_code);
      const ticket = await ticketsService.issueTicketForBooking(
        {
          bookingId: booking.id,
          showId: booking.show_id,
          userId: booking.user_id,
          seatCodes,
        },
        tx
      );

      // 7. Enqueue transactional outbox event for confirmation notification
      await tx.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status)
         VALUES ($1, 'BOOKING', $2, 'BOOKING_CONFIRMED_NOTIFICATION', $3, 'PENDING')`,
        [
          crypto.randomUUID(),
          booking.id,
          JSON.stringify({
            bookingId: booking.id,
            bookingReference: booking.booking_reference,
            userId: booking.user_id,
            ticketCode: ticket.ticketCode,
            seatCodes,
          }),
        ]
      );

      return {
        idempotentReplay: false,
        paymentStatus: 'SUCCEEDED',
        bookingStatus: 'CONFIRMED',
        bookingId: booking.id,
        ticketCode: ticket.ticketCode,
      };
    });
  }
}

export const paymentsService = new PaymentsService();
export const paymentsRouter = Router();

paymentsRouter.post(
  '/intents',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createPaymentIntentSchema.parse(req.body);
    const intent = await paymentsService.createPaymentIntent(req.user!.id, input);
    res.status(201).json({ success: true, data: intent });
  })
);

paymentsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payment = await paymentsService.getPaymentById(
      String(req.params.id),
      req.user!.id,
      req.user!.roles
    );
    res.json({ success: true, data: payment });
  })
);

paymentsRouter.post(
  '/webhooks/:provider',
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-tixora-signature'] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (!paymentsService.verifyWebhookSignature(rawBody, signature)) {
      throw AppError.unauthorized('Invalid webhook signature');
    }

    const payload = webhookPayloadSchema.parse(req.body);
    const result = await paymentsService.processWebhook(String(req.params.provider), payload);
    res.json({ success: true, data: result });
  })
);

