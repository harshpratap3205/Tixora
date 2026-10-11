import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';
import { requireAuth } from '../identity/identity.module';

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).optional(),
  preferredCity: z.string().max(80).optional(),
});

export class UsersService {
  public async getProfile(userId: string) {
    const res = await db.query(
      `SELECT id, email, full_name as "fullName", phone, preferred_city as "preferredCity",
              status, created_at as "createdAt"
       FROM users WHERE id = $1`,
      [userId]
    );
    if (res.rows.length === 0) {
      throw AppError.notFound('User not found');
    }

    const rolesRes = await db.query<{ name: string }>(
      `SELECT r.name FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );
    const staffRes = await db.query(
      `SELECT cs.cinema_id as "cinemaId", c.name as "cinemaName", c.city, cs.permission_role as "permissionRole"
       FROM cinema_staff cs
       INNER JOIN cinemas c ON c.id = cs.cinema_id
       WHERE cs.user_id = $1`,
      [userId]
    );

    return {
      ...res.rows[0],
      roles: rolesRes.rows.map((r) => r.name),
      managedCinemas: staffRes.rows,
    };
  }

  public async updateProfile(userId: string, input: z.infer<typeof updateProfileSchema>) {
    await db.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           preferred_city = COALESCE($3, preferred_city),
           updated_at = NOW()
       WHERE id = $4`,
      [input.fullName ?? null, input.phone ?? null, input.preferredCity ?? null, userId]
    );
    return this.getProfile(userId);
  }

  public async getUserBookings(userId: string) {
    const res = await db.query(
      `SELECT b.id, b.booking_reference as "bookingReference", b.status,
              b.subtotal_amount::float as "subtotalAmount",
              b.convenience_fee::float as "convenienceFee",
              b.tax_amount::float as "taxAmount",
              b.total_amount::float as "totalAmount",
              b.currency, b.created_at as "createdAt", b.confirmed_at as "confirmedAt",
              b.cancelled_at as "cancelledAt", b.cancellation_reason as "cancellationReason",
              s.id as "showId", s.start_time as "startTime", s.end_time as "endTime",
              s.language, s.format,
              m.id as "movieId", m.title as "movieTitle", m.poster_url as "posterUrl",
              m.duration_minutes as "durationMinutes", m.age_rating as "ageRating",
              c.id as "cinemaId", c.name as "cinemaName", c.city as "cinemaCity",
              sc.name as "screenName",
              t.ticket_code as "ticketCode", t.qr_token as "qrToken", t.status as "ticketStatus"
       FROM bookings b
       INNER JOIN shows s ON s.id = b.show_id
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       LEFT JOIN tickets t ON t.booking_id = b.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );

    const bookings = [];
    for (const row of res.rows) {
      const itemsRes = await db.query(
        `SELECT seat_code as "seatCode", row_label as "rowLabel",
                seat_number as "seatNumber", category, price::float as price
         FROM booking_items WHERE booking_id = $1 ORDER BY seat_code`,
        [row.id]
      );
      bookings.push({
        ...row,
        seats: itemsRes.rows,
      });
    }
    return bookings;
  }
}

export const usersService = new UsersService();
export const usersRouter = Router();

usersRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await usersService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  })
);

usersRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const profile = await usersService.updateProfile(req.user!.id, input);
    res.json({ success: true, data: profile });
  })
);

usersRouter.get(
  '/me/bookings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const bookings = await usersService.getUserBookings(req.user!.id);
    res.json({ success: true, data: bookings });
  })
);

