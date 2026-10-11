import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';
import { requireAuth } from '../identity/identity.module';
import { inventoryService } from '../inventory/inventory.module';
import { ticketsService } from '../tickets/tickets.module';

export const createBookingSchema = z.object({
  holdId: z.string().uuid(),
  idempotencyKey: z.string().min(6).max(120),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(300).optional(),
});

export class BookingsService {
  public async createBooking(userId: string, input: z.infer<typeof createBookingSchema>) {
    // 1. Check idempotency key outside or inside transaction
    const existingByIdem = await db.query<{ id: string }>(
      `SELECT id FROM bookings WHERE idempotency_key = $1 OR hold_id = $2`,
      [input.idempotencyKey, input.holdId]
    );
    if (existingByIdem.rows.length > 0) {
      return this.getBookingDetails(existingByIdem.rows[0].id, userId, ['CUSTOMER']);
    }

    const bookingId = await db.withTransaction(async (tx) => {
      await inventoryService.releaseExpiredHolds(tx);

      const holdRes = await tx.query<{
        id: string;
        show_id: string;
        user_id: string;
        status: string;
        expires_at: string;
        total_amount: string;
        currency: string;
      }>(
        `SELECT id, show_id, user_id, status, expires_at, total_amount::text as total_amount, currency
         FROM seat_holds
         WHERE id = $1
         FOR UPDATE`,
        [input.holdId]
      );

      if (holdRes.rows.length === 0) {
        throw AppError.notFound('Seat hold not found');
      }

      const hold = holdRes.rows[0];
      if (hold.user_id !== userId) {
        throw AppError.forbidden('You do not own this seat reservation');
      }

      if (hold.status !== 'ACTIVE' || new Date(hold.expires_at).getTime() <= Date.now()) {
        throw AppError.conflict('Seat hold has expired or was already used');
      }

      const holdItems = await tx.query<{
        show_seat_id: string;
        seat_code: string;
        category: string;
        price: string;
      }>(
        `SELECT show_seat_id, seat_code, category, price::text as price
         FROM seat_hold_items
         WHERE hold_id = $1
         ORDER BY seat_code ASC`,
        [hold.id]
      );

      if (holdItems.rows.length === 0) {
        throw AppError.badRequest('Seat hold contains no seats');
      }

      const subtotal = holdItems.rows.reduce((sum, i) => sum + parseFloat(i.price), 0);
      const convenienceFee = Math.round(subtotal * 0.08 * 100) / 100;
      const taxAmount = Math.round(convenienceFee * 0.18 * 100) / 100;
      const totalAmount = Math.round((subtotal + convenienceFee + taxAmount) * 100) / 100;

      const newBookingId = crypto.randomUUID();
      const bookingRef = `TXR-${Date.now().toString(36).toUpperCase().slice(-4)}-${crypto
        .randomBytes(2)
        .toString('hex')
        .toUpperCase()}`;

      await tx.query(
        `INSERT INTO bookings (
          id, booking_reference, user_id, show_id, hold_id, idempotency_key,
          status, subtotal_amount, convenience_fee, tax_amount, total_amount, currency
        ) VALUES ($1,$2,$3,$4,$5,$6,'PENDING_PAYMENT',$7,$8,$9,$10,$11)`,
        [
          newBookingId,
          bookingRef,
          userId,
          hold.show_id,
          hold.id,
          input.idempotencyKey,
          subtotal,
          convenienceFee,
          taxAmount,
          totalAmount,
          hold.currency,
        ]
      );

      for (const item of holdItems.rows) {
        const seatMeta = await tx.query<{ row_label: string; seat_number: number }>(
          `SELECT row_label, seat_number FROM show_seats WHERE id = $1`,
          [item.show_seat_id]
        );
        const rowLabel = seatMeta.rows[0]?.row_label || item.seat_code.slice(0, 1);
        const seatNumber =
          seatMeta.rows[0]?.seat_number || parseInt(item.seat_code.slice(1), 10) || 1;

        await tx.query(
          `INSERT INTO booking_items (
            id, booking_id, show_seat_id, seat_code, row_label, seat_number, category, price, currency
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            crypto.randomUUID(),
            newBookingId,
            item.show_seat_id,
            item.seat_code,
            rowLabel,
            seatNumber,
            item.category,
            parseFloat(item.price),
            hold.currency,
          ]
        );
      }

      return newBookingId;
    });

    return this.getBookingDetails(bookingId, userId, ['CUSTOMER']);
  }

  public async getBookingDetails(
    bookingId: string,
    requesterUserId: string,
    requesterRoles: string[]
  ) {
    await inventoryService.releaseExpiredHolds();

    const res = await db.query(
      `SELECT b.id, b.booking_reference as "bookingReference",
              b.user_id as "userId", b.show_id as "showId", b.hold_id as "holdId",
              b.status,
              b.subtotal_amount::float as "subtotalAmount",
              b.convenience_fee::float as "convenienceFee",
              b.tax_amount::float as "taxAmount",
              b.total_amount::float as "totalAmount",
              b.currency, b.cancellation_reason as "cancellationReason",
              b.confirmed_at as "confirmedAt", b.cancelled_at as "cancelledAt",
              b.created_at as "createdAt",
              h.expires_at as "holdExpiresAt", h.status as "holdStatus",
              s.start_time as "startTime", s.end_time as "endTime",
              s.language, s.format,
              m.id as "movieId", m.title as "movieTitle", m.poster_url as "posterUrl",
              m.backdrop_url as "backdropUrl", m.duration_minutes as "durationMinutes",
              m.age_rating as "ageRating",
              c.id as "cinemaId", c.name as "cinemaName", c.city as "cinemaCity",
              c.neighborhood as "cinemaNeighborhood", c.address as "cinemaAddress",
              sc.id as "screenId", sc.name as "screenName", sc.format_type as "screenFormat",
              t.id as "ticketId", t.ticket_code as "ticketCode",
              t.qr_token as "qrToken", t.status as "ticketStatus"
       FROM bookings b
       INNER JOIN seat_holds h ON h.id = b.hold_id
       INNER JOIN shows s ON s.id = b.show_id
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       LEFT JOIN tickets t ON t.booking_id = b.id
       WHERE b.id = $1`,
      [bookingId]
    );

    if (res.rows.length === 0) {
      throw AppError.notFound('Booking not found');
    }

    const booking = res.rows[0];
    const isPrivileged = requesterRoles.some((r) =>
      ['PLATFORM_ADMIN', 'CINEMA_MANAGER', 'CINEMA_STAFF'].includes(r)
    );
    if (booking.userId !== requesterUserId && !isPrivileged) {
      throw AppError.forbidden('You do not have permission to view this booking');
    }

    const itemsRes = await db.query(
      `SELECT show_seat_id as "showSeatId", seat_code as "seatCode",
              row_label as "rowLabel", seat_number as "seatNumber",
              category, price::float as price
       FROM booking_items
       WHERE booking_id = $1
       ORDER BY seat_code ASC`,
      [bookingId]
    );

    const paymentsRes = await db.query(
      `SELECT id, provider, provider_intent_id as "providerIntentId",
              amount::float as amount, currency, status,
              payment_method as "paymentMethod", failure_reason as "failureReason",
              reconciliation_notes as "reconciliationNotes",
              completed_at as "completedAt", created_at as "createdAt"
       FROM payments
       WHERE booking_id = $1
       ORDER BY created_at DESC`,
      [bookingId]
    );

    return {
      ...booking,
      seats: itemsRes.rows,
      payments: paymentsRes.rows,
    };
  }

  public async cancelBooking(
    bookingId: string,
    userId: string,
    roles: string[],
    reason?: string
  ) {
    await db.withTransaction(async (tx) => {
      const bRes = await tx.query<{
        id: string;
        user_id: string;
        hold_id: string;
        show_id: string;
        status: string;
      }>(`SELECT id, user_id, hold_id, show_id, status FROM bookings WHERE id = $1 FOR UPDATE`, [
        bookingId,
      ]);

      if (bRes.rows.length === 0) {
        throw AppError.notFound('Booking not found');
      }

      const booking = bRes.rows[0];
      const isAdmin = roles.includes('PLATFORM_ADMIN');
      if (booking.user_id !== userId && !isAdmin) {
        throw AppError.forbidden('You cannot cancel another customer booking');
      }

      if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
        throw AppError.conflict('Booking is already cancelled');
      }

      // Check if ticket was already checked in at the cinema gate
      const tRes = await tx.query<{ status: string }>(
        `SELECT status FROM tickets WHERE booking_id = $1`,
        [bookingId]
      );
      if (tRes.rows[0]?.status === 'CHECKED_IN') {
        throw AppError.conflict('Cannot cancel a booking after ticket check-in');
      }

      const newBookingStatus =
        booking.status === 'CONFIRMED' ? 'CANCELLED' : 'CANCELLED';

      await tx.query(
        `UPDATE bookings
         SET status = $1,
             cancellation_reason = $2,
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [newBookingStatus, reason || 'Cancelled by customer', bookingId]
      );

      await tx.query(
        `UPDATE seat_holds SET status = 'RELEASED', updated_at = NOW() WHERE id = $1`,
        [booking.hold_id]
      );

      // Release seats back to AVAILABLE
      const itemRes = await tx.query<{ show_seat_id: string }>(
        `SELECT show_seat_id FROM booking_items WHERE booking_id = $1`,
        [bookingId]
      );
      for (const item of itemRes.rows) {
        await tx.query(
          `UPDATE show_seats
           SET status = 'AVAILABLE',
               active_hold_id = NULL,
               hold_expires_at = NULL,
               booking_id = NULL,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [item.show_seat_id]
        );
      }

      // Void any issued QR ticket
      await tx.query(`UPDATE tickets SET status = 'VOIDED' WHERE booking_id = $1`, [
        bookingId,
      ]);

      // Mark succeeded payment as REFUNDED
      await tx.query(
        `UPDATE payments
         SET status = 'REFUNDED',
             reconciliation_notes = 'Refund processed upon booking cancellation',
             updated_at = NOW()
         WHERE booking_id = $1 AND status = 'SUCCEEDED'`,
        [bookingId]
      );
    });

    return this.getBookingDetails(bookingId, userId, roles);
  }
}

export const bookingsService = new BookingsService();
export const bookingsRouter = Router();

bookingsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createBookingSchema.parse(req.body);
    const booking = await bookingsService.createBooking(req.user!.id, input);
    res.status(201).json({ success: true, data: booking });
  })
);

bookingsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await bookingsService.getBookingDetails(
      req.params.id,
      req.user!.id,
      req.user!.roles
    );
    res.json({ success: true, data: booking });
  })
);

bookingsRouter.get(
  '/:id/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = await bookingsService.getBookingDetails(
      req.params.id,
      req.user!.id,
      req.user!.roles
    );
    res.json({
      success: true,
      data: {
        id: booking.id,
        bookingReference: booking.bookingReference,
        status: booking.status,
        ticketCode: booking.ticketCode,
        confirmedAt: booking.confirmedAt,
      },
    });
  })
);

bookingsRouter.get(
  '/:id/ticket',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ticket = await ticketsService.getTicketByBooking(
      req.params.id,
      req.user!.id,
      req.user!.roles
    );
    res.json({ success: true, data: ticket });
  })
);

bookingsRouter.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = cancelBookingSchema.parse(req.body || {});
    const booking = await bookingsService.cancelBooking(
      req.params.id,
      req.user!.id,
      req.user!.roles,
      input.reason
    );
    res.json({ success: true, data: booking });
  })
);
