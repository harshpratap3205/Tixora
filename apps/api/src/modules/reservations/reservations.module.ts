import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { config } from '../../common/config';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';
import { requireAuth } from '../identity/identity.module';
import { inventoryService } from '../inventory/inventory.module';

export const createHoldSchema = z.object({
  showId: z.string().uuid(),
  seatCodes: z
    .array(z.string().min(2).max(10))
    .min(1, 'Select at least 1 seat')
    .max(10, 'Maximum 10 seats allowed per reservation'),
  holdDurationSeconds: z.number().int().min(5).max(900).optional(),
});

export class ReservationsService {
  /**
   * Atomically claims all requested seats for a show in a single PostgreSQL transaction.
   * - Deterministic lock ordering (ORDER BY seat_code ASC FOR UPDATE) prevents deadlocks.
   * - All-or-nothing semantics: if even one seat is HELD, BOOKED, or BLOCKED, the entire
   *   transaction rolls back and throws HTTP 409 Conflict.
   */
  public async createHold(userId: string, input: z.infer<typeof createHoldSchema>) {
    const uniqueSeatCodes = Array.from(new Set(input.seatCodes.map((c) => c.trim().toUpperCase()))).sort();

    return db.withTransaction(async (tx) => {
      // 1. Release any expired holds first inside the transaction
      await inventoryService.releaseExpiredHolds(tx);

      // 2. Verify show exists and is PUBLISHED
      const showRes = await tx.query<{
        id: string;
        status: string;
        start_time: string;
        currency: string;
      }>('SELECT id, status, start_time, currency FROM shows WHERE id = $1', [input.showId]);

      if (showRes.rows.length === 0) {
        throw AppError.notFound('Showtime not found');
      }

      const show = showRes.rows[0];
      if (show.status !== 'PUBLISHED') {
        throw AppError.badRequest('Showtime is not open for reservations');
      }

      // 3. Lock requested show_seats in deterministic ascending order of seat_code
      const lockedSeatsRes = await tx.query<{
        id: string;
        seat_code: string;
        category: string;
        price: string;
        status: string;
        active_hold_id: string | null;
        hold_expires_at: string | null;
      }>(
        `SELECT id, seat_code, category, price::text as price, status, active_hold_id, hold_expires_at
         FROM show_seats
         WHERE show_id = $1 AND seat_code = ANY($2::varchar[])
         ORDER BY seat_code ASC
         FOR UPDATE`,
        [input.showId, uniqueSeatCodes]
      );

      if (lockedSeatsRes.rows.length !== uniqueSeatCodes.length) {
        throw AppError.badRequest('One or more requested seat codes do not exist on this screen');
      }

      const unavailableSeats = lockedSeatsRes.rows.filter((s) => s.status !== 'AVAILABLE');
      if (unavailableSeats.length > 0) {
        throw AppError.conflict(
          `Seats are no longer available: ${unavailableSeats.map((s) => s.seat_code).join(', ')}`,
          {
            unavailableSeatCodes: unavailableSeats.map((s) => s.seat_code),
          }
        );
      }

      // 4. Create the seat hold record
      const holdId = crypto.randomUUID();
      const durationSec = input.holdDurationSeconds ?? config.holdDurationSeconds;
      const expiresAt = new Date(Date.now() + durationSec * 1000);
      const totalAmount = lockedSeatsRes.rows.reduce(
        (sum, s) => sum + parseFloat(s.price),
        0
      );

      await tx.query(
        `INSERT INTO seat_holds (id, show_id, user_id, status, expires_at, total_amount, currency)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6)`,
        [holdId, input.showId, userId, expiresAt.toISOString(), totalAmount, show.currency]
      );

      // 5. Transition all requested seats AVAILABLE -> HELD atomically
      for (const seat of lockedSeatsRes.rows) {
        const updateRes = await tx.query(
          `UPDATE show_seats
           SET status = 'HELD',
               active_hold_id = $1,
               hold_expires_at = $2,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $3 AND status = 'AVAILABLE'`,
          [holdId, expiresAt.toISOString(), seat.id]
        );

        if (updateRes.rowCount !== 1) {
          throw AppError.conflict(`Seat ${seat.seat_code} was claimed by another user`);
        }

        await tx.query(
          `INSERT INTO seat_hold_items (id, hold_id, show_seat_id, seat_code, category, price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            crypto.randomUUID(),
            holdId,
            seat.id,
            seat.seat_code,
            seat.category,
             parseFloat(seat.price),
          ]
        );
      }

      return {
        id: holdId,
        showId: input.showId,
        userId,
        status: 'ACTIVE',
        expiresAt: expiresAt.toISOString(),
        totalAmount,
        currency: show.currency,
        seats: lockedSeatsRes.rows.map((s) => ({
          showSeatId: s.id,
          seatCode: s.seat_code,
          category: s.category,
          price: parseFloat(s.price),
        })),
      };
    });
  }

  public async getHold(holdId: string, userId: string) {
    await inventoryService.releaseExpiredHolds();

    const holdRes = await db.query(
      `SELECT h.id, h.show_id as "showId", h.user_id as "userId",
              h.status, h.expires_at as "expiresAt",
              h.total_amount::float as "totalAmount", h.currency,
              h.created_at as "createdAt",
              s.start_time as "startTime", s.format, s.language,
              m.title as "movieTitle", m.poster_url as "posterUrl",
              c.name as "cinemaName", c.city as "cinemaCity",
              sc.name as "screenName"
       FROM seat_holds h
       INNER JOIN shows s ON s.id = h.show_id
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       WHERE h.id = $1`,
      [holdId]
    );

    if (holdRes.rows.length === 0) {
      throw AppError.notFound('Seat hold not found');
    }

    const hold = holdRes.rows[0];
    if (hold.userId !== userId) {
      throw AppError.forbidden('You do not own this seat hold');
    }

    const itemsRes = await db.query(
      `SELECT show_seat_id as "showSeatId", seat_code as "seatCode",
              category, price::float as price
       FROM seat_hold_items
       WHERE hold_id = $1
       ORDER BY seat_code ASC`,
      [holdId]
    );

    return {
      ...hold,
      seats: itemsRes.rows,
    };
  }

  public async releaseHold(holdId: string, userId: string) {
    return db.withTransaction(async (tx) => {
      const holdRes = await tx.query<{ id: string; user_id: string; status: string }>(
        `SELECT id, user_id, status FROM seat_holds WHERE id = $1 FOR UPDATE`,
        [holdId]
      );

      if (holdRes.rows.length === 0) {
        throw AppError.notFound('Seat hold not found');
      }

      const hold = holdRes.rows[0];
      if (hold.user_id !== userId) {
        throw AppError.forbidden('You do not own this seat hold');
      }

      if (hold.status === 'ACTIVE') {
        await tx.query(
          `UPDATE seat_holds SET status = 'RELEASED', updated_at = NOW() WHERE id = $1`,
          [holdId]
        );
        await tx.query(
          `UPDATE show_seats
           SET status = 'AVAILABLE',
               active_hold_id = NULL,
               hold_expires_at = NULL,
               version = version + 1,
               updated_at = NOW()
           WHERE active_hold_id = $1 AND status = 'HELD'`,
          [holdId]
        );
      }

      return { id: holdId, status: 'RELEASED' };
    });
  }
}

export const reservationsService = new ReservationsService();
export const reservationsRouter = Router();

reservationsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createHoldSchema.parse(req.body);
    const hold = await reservationsService.createHold(req.user!.id, input);
    res.status(201).json({ success: true, data: hold });
  })
);

reservationsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const hold = await reservationsService.getHold(req.params.id, req.user!.id);
    res.json({ success: true, data: hold });
  })
);

reservationsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await reservationsService.releaseHold(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  })
);
