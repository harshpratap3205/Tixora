import crypto from 'crypto';
import { db, DbExecutor } from '../../db';
import { config } from '../../common/config';
import { AppError } from '../../common/errors';

export class TicketsService {
  public createSignedQrToken(bookingId: string, showId: string, seatCodes: string[]): string {
    const nonce = crypto.randomBytes(12).toString('hex');
    const payload = `${bookingId}:${showId}:${seatCodes.join(',')}:${nonce}`;
    const signature = crypto
      .createHmac('sha256', config.qrSigningSecret)
      .update(payload)
      .digest('hex')
      .slice(0, 32);
    return `TXQR.${Buffer.from(payload).toString('base64url')}.${signature}`;
  }

  public verifySignedQrToken(qrToken: string): boolean {
    if (!qrToken.startsWith('TXQR.')) return false;
    const parts = qrToken.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const expectedSig = crypto
        .createHmac('sha256', config.qrSigningSecret)
        .update(payload)
        .digest('hex')
        .slice(0, 32);
      return crypto.timingSafeEqual(
        Buffer.from(parts[2], 'utf-8'),
        Buffer.from(expectedSig, 'utf-8')
      );
    } catch {
      return false;
    }
  }

  public async issueTicketForBooking(
    params: {
      bookingId: string;
      showId: string;
      userId: string;
      seatCodes: string[];
    },
    tx?: DbExecutor
  ) {
    const executor = tx || db;

    const existing = await executor.query(
      `SELECT id, ticket_code as "ticketCode", qr_token as "qrToken", status
       FROM tickets WHERE booking_id = $1`,
      [params.bookingId]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const ticketId = crypto.randomUUID();
    const ticketCode = `TIX-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const qrToken = this.createSignedQrToken(params.bookingId, params.showId, params.seatCodes);
    const qrPayload = JSON.stringify({
      ticketCode,
      bookingId: params.bookingId,
      showId: params.showId,
      seats: params.seatCodes,
      qrToken,
    });

    await executor.query(
      `INSERT INTO tickets (
        id, ticket_code, booking_id, show_id, user_id, qr_token, qr_payload, seat_codes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ISSUED')`,
      [
        ticketId,
        ticketCode,
        params.bookingId,
        params.showId,
        params.userId,
        qrToken,
        qrPayload,
        params.seatCodes,
      ]
    );

    return {
      id: ticketId,
      ticketCode,
      qrToken,
      status: 'ISSUED',
    };
  }

  public async getTicketByBooking(bookingId: string, requesterUserId: string, requesterRoles: string[]) {
    const res = await db.query(
      `SELECT t.id, t.ticket_code as "ticketCode", t.booking_id as "bookingId",
              t.show_id as "showId", t.user_id as "userId",
              t.qr_token as "qrToken", t.qr_payload as "qrPayload",
              t.seat_codes as "seatCodes", t.status,
              t.issued_at as "issuedAt", t.checked_in_at as "checkedInAt",
              b.booking_reference as "bookingReference",
              b.total_amount::float as "totalAmount", b.currency, b.status as "bookingStatus",
              s.start_time as "startTime", s.end_time as "endTime", s.language, s.format,
              m.title as "movieTitle", m.poster_url as "posterUrl",
              m.duration_minutes as "durationMinutes", m.age_rating as "ageRating",
              c.id as "cinemaId", c.name as "cinemaName", c.city as "cinemaCity", c.address as "cinemaAddress",
              sc.name as "screenName", sc.format_type as "screenFormat"
       FROM tickets t
       INNER JOIN bookings b ON b.id = t.booking_id
       INNER JOIN shows s ON s.id = t.show_id
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       WHERE t.booking_id = $1`,
      [bookingId]
    );

    if (res.rows.length === 0) {
      throw AppError.notFound('Ticket has not been issued for this booking');
    }

    const ticket = res.rows[0];
    const isAdminOrStaff = requesterRoles.some((r) =>
      ['PLATFORM_ADMIN', 'CINEMA_MANAGER', 'CINEMA_STAFF'].includes(r)
    );
    if (ticket.userId !== requesterUserId && !isAdminOrStaff) {
      throw AppError.forbidden('You do not have permission to view this ticket');
    }

    return ticket;
  }

  public async validateAndCheckInTicket(params: {
    qrTokenOrCode: string;
    staffUserId: string;
    allowedCinemaIds: string[];
    isPlatformAdmin: boolean;
  }) {
    const tokenOrCode = params.qrTokenOrCode.trim();

    if (tokenOrCode.startsWith('TXQR.') && !this.verifySignedQrToken(tokenOrCode)) {
      throw AppError.badRequest('Cryptographic QR signature verification failed — invalid or forged ticket');
    }

    return db.withTransaction(async (tx) => {
      const res = await tx.query<{
        id: string;
        ticket_code: string;
        booking_id: string;
        show_id: string;
        qr_token: string;
        seat_codes: string[];
        status: string;
        checked_in_at: string | null;
        booking_status: string;
        cinema_id: string;
        cinema_name: string;
        movie_title: string;
        screen_name: string;
        start_time: string;
      }>(
        `SELECT t.id, t.ticket_code, t.booking_id, t.show_id, t.qr_token,
                t.seat_codes, t.status, t.checked_in_at,
                b.status as booking_status,
                s.cinema_id, c.name as cinema_name,
                m.title as movie_title, sc.name as screen_name, s.start_time
         FROM tickets t
         INNER JOIN bookings b ON b.id = t.booking_id
         INNER JOIN shows s ON s.id = t.show_id
         INNER JOIN cinemas c ON c.id = s.cinema_id
         INNER JOIN movies m ON m.id = s.movie_id
         INNER JOIN screens sc ON sc.id = s.screen_id
         WHERE t.qr_token = $1 OR t.ticket_code = $1
         FOR UPDATE`,
        [tokenOrCode]
      );

      if (res.rows.length === 0) {
        throw AppError.notFound('Ticket not found');
      }

      const ticket = res.rows[0];

      // Enforce cinema-scoped authorization for check-in staff/managers
      if (!params.isPlatformAdmin && !params.allowedCinemaIds.includes(ticket.cinema_id)) {
        throw AppError.forbidden(
          `Staff member is not authorized to validate tickets for ${ticket.cinema_name}`
        );
      }

      if (ticket.booking_status !== 'CONFIRMED' || ticket.status === 'VOIDED') {
        await tx.query(
          `INSERT INTO ticket_checkins (id, ticket_id, cinema_id, staff_user_id, verification_status, notes)
           VALUES ($1, $2, $3, $4, 'INVALID_REJECTED', 'Booking is cancelled or not confirmed')`,
          [crypto.randomUUID(), ticket.id, ticket.cinema_id, params.staffUserId]
        );
        throw AppError.conflict('Ticket has been voided or booking was cancelled');
      }

      if (ticket.status === 'CHECKED_IN') {
        await tx.query(
          `INSERT INTO ticket_checkins (id, ticket_id, cinema_id, staff_user_id, verification_status, notes)
           VALUES ($1, $2, $3, $4, 'DUPLICATE_REJECTED', 'Duplicate scan attempt')`,
          [crypto.randomUUID(), ticket.id, ticket.cinema_id, params.staffUserId]
        );
        throw AppError.conflict(
          `Duplicate check-in rejected: Ticket ${ticket.ticket_code} was already checked in at ${ticket.checked_in_at}`
        );
      }

      await tx.query(
        `UPDATE tickets
         SET status = 'CHECKED_IN',
             checked_in_at = NOW(),
             checked_in_by = $1
         WHERE id = $2`,
        [params.staffUserId, ticket.id]
      );

      await tx.query(
        `INSERT INTO ticket_checkins (id, ticket_id, cinema_id, staff_user_id, verification_status, notes)
         VALUES ($1, $2, $3, $4, 'VALID_CHECKIN', 'Verified at entry gate')`,
        [crypto.randomUUID(), ticket.id, ticket.cinema_id, params.staffUserId]
      );

      return {
        valid: true,
        ticketCode: ticket.ticket_code,
        bookingId: ticket.booking_id,
        movieTitle: ticket.movie_title,
        cinemaName: ticket.cinema_name,
        screenName: ticket.screen_name,
        startTime: ticket.start_time,
        seatCodes: ticket.seat_codes,
        status: 'CHECKED_IN',
        checkedInAt: new Date().toISOString(),
      };
    });
  }
}

export const ticketsService = new TicketsService();

