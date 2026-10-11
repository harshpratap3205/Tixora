import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';
import {
  requireAuth,
  requireRoles,
  assertCinemaAccess,
} from '../identity/identity.module';
import {
  cinemasService,
  createCinemaSchema,
  updateCinemaSchema,
} from '../cinemas/cinemas.module';
import {
  screensService,
  createScreenSchema,
  updateSeatLayoutSchema,
} from '../screens/screens.module';
import {
  showtimesService,
  createShowSchema,
  updateShowPricingSchema,
} from '../showtimes/showtimes.module';
import {
  catalogService,
  createMovieSchema,
  updateMovieSchema,
} from '../catalog/catalog.module';
import { ticketsService } from '../tickets/tickets.module';
import { auditingService } from '../auditing/auditing.service';

export const managerRouter = Router();
export const adminRouter = Router();

// ============================================================================
// CINEMA MANAGER & STAFF ROUTES (/api/v1/manager)
// ============================================================================

managerRouter.use(
  requireAuth,
  requireRoles('CINEMA_MANAGER', 'CINEMA_STAFF', 'PLATFORM_ADMIN')
);

managerRouter.get(
  '/cinemas',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.roles.includes('PLATFORM_ADMIN');
    if (isAdmin) {
      const all = await cinemasService.listCinemas({ includeAll: true });
      res.json({ success: true, data: all });
      return;
    }

    if (req.user!.managedCinemaIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const cinemasRes = await db.query(
      `SELECT c.id, c.name, c.slug, c.city, c.neighborhood, c.address,
              c.facilities, c.status, c.timezone,
              (SELECT COUNT(*)::int FROM screens sc WHERE sc.cinema_id = c.id) as "screenCount"
       FROM cinemas c
       WHERE c.id = ANY($1::uuid[])
       ORDER BY c.name ASC`,
      [req.user!.managedCinemaIds]
    );
    res.json({ success: true, data: cinemasRes.rows });
  })
);

managerRouter.post(
  '/cinemas',
  requireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createCinemaSchema.parse(req.body);
    const cinema = await cinemasService.createCinema(input, req.user!.id);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'CINEMA_MANAGER',
      action: 'CINEMA_CREATED',
      entityType: 'CINEMA',
      entityId: cinema.id,
      cinemaId: cinema.id,
      metadata: { name: cinema.name, city: cinema.city },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: cinema });
  })
);

managerRouter.patch(
  '/cinemas/:id',
  requireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN'),
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    assertCinemaAccess(req.user, id);
    const input = updateCinemaSchema.parse(req.body);
    const updated = await cinemasService.updateCinema(id, input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'CINEMA_MANAGER',
      action: 'CINEMA_UPDATED',
      entityType: 'CINEMA',
      entityId: id,
      cinemaId: id,
      metadata: input,
      ipAddress: req.ip,
    });
    res.json({ success: true, data: updated });
  })
);

managerRouter.get(
  '/screens/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const screen = await screensService.getScreenWithSeats(id);
    assertCinemaAccess(req.user, screen.cinemaId);
    res.json({ success: true, data: screen });
  })
);

managerRouter.post(
  '/cinemas/:id/screens',
  requireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN'),
  asyncHandler(async (req, res) => {
    const cinemaId = String(req.params.id);
    assertCinemaAccess(req.user, cinemaId);
    const input = createScreenSchema.parse(req.body);
    const screen = await screensService.createScreen(cinemaId, input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'CINEMA_MANAGER',
      action: 'SCREEN_CREATED',
      entityType: 'SCREEN',
      entityId: screen.id,
      cinemaId,
      metadata: { name: screen.name, rows: screen.totalRows, cols: screen.totalCols },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: screen });
  })
);

managerRouter.put(
  '/screens/:id/seats',
  requireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN'),
  asyncHandler(async (req, res) => {
    const screenId = String(req.params.id);
    const screen = await screensService.getScreenWithSeats(screenId);
    assertCinemaAccess(req.user, screen.cinemaId);
    const input = updateSeatLayoutSchema.parse(req.body);
    const updated = await screensService.updateScreenSeats(screenId, input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'CINEMA_MANAGER',
      action: 'SCREEN_LAYOUT_UPDATED',
      entityType: 'SCREEN',
      entityId: screenId,
      cinemaId: screen.cinemaId,
      metadata: { modifiedSeatCount: input.seats.length },
      ipAddress: req.ip,
    });
    res.json({ success: true, data: updated });
  })
);

managerRouter.post(
  '/shows',
  requireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createShowSchema.parse(req.body);
    assertCinemaAccess(req.user, input.cinemaId);
    const show = await showtimesService.createShow(input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'CINEMA_MANAGER',
      action: 'SHOWTIME_SCHEDULED',
      entityType: 'SHOW',
      entityId: show.id,
      cinemaId: input.cinemaId,
      metadata: {
        movieId: input.movieId,
        screenId: input.screenId,
        startTime: input.startTime,
      },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: show });
  })
);

managerRouter.patch(
  '/shows/:id',
  requireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN'),
  asyncHandler(async (req, res) => {
    const showId = String(req.params.id);
    const existing = await showtimesService.getShowDetails(showId);
    assertCinemaAccess(req.user, existing.cinemaId);
    const statusSchema = z.object({
      status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']),
    });
    const body = statusSchema.parse(req.body);
    const updated = await showtimesService.updateShowStatus(showId, body.status);
    res.json({ success: true, data: updated });
  })
);

managerRouter.put(
  '/shows/:id/pricing',
  requireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN'),
  asyncHandler(async (req, res) => {
    const showId = String(req.params.id);
    const existing = await showtimesService.getShowDetails(showId);
    assertCinemaAccess(req.user, existing.cinemaId);
    const input = updateShowPricingSchema.parse(req.body);
    const updated = await showtimesService.updateShowPricing(showId, input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'CINEMA_MANAGER',
      action: 'SHOW_PRICING_UPDATED',
      entityType: 'SHOW',
      entityId: showId,
      cinemaId: existing.cinemaId,
      metadata: input.categoryPrices,
      ipAddress: req.ip,
    });
    res.json({ success: true, data: updated });
  })
);

managerRouter.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.roles.includes('PLATFORM_ADMIN');
    const cinemaId = req.query.cinemaId as string | undefined;

    if (cinemaId) {
      assertCinemaAccess(req.user, cinemaId);
    }

    const allowedCinemas = cinemaId
      ? [cinemaId]
      : isAdmin
      ? null
      : req.user!.managedCinemaIds;

    if (allowedCinemas && allowedCinemas.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const params: any[] = [];
    let whereClause = '';
    if (allowedCinemas) {
      params.push(allowedCinemas);
      whereClause = `WHERE s.cinema_id = ANY($1::uuid[])`;
    }

    const bookingsRes = await db.query(
      `SELECT b.id, b.booking_reference as "bookingReference", b.status,
              b.total_amount::float as "totalAmount", b.currency,
              b.created_at as "createdAt", b.confirmed_at as "confirmedAt",
              u.full_name as "customerName", u.email as "customerEmail",
              m.title as "movieTitle", c.id as "cinemaId", c.name as "cinemaName",
              sc.name as "screenName", s.start_time as "startTime",
              t.ticket_code as "ticketCode", t.status as "ticketStatus",
              t.checked_in_at as "checkedInAt"
       FROM bookings b
       INNER JOIN users u ON u.id = b.user_id
       INNER JOIN shows s ON s.id = b.show_id
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       LEFT JOIN tickets t ON t.booking_id = b.id
       ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT 100`,
      params
    );

    res.json({ success: true, data: bookingsRes.rows });
  })
);

managerRouter.post(
  '/tickets/validate',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      qrTokenOrCode: z.string().min(4),
    });
    const body = schema.parse(req.body);
    const isAdmin = req.user!.roles.includes('PLATFORM_ADMIN');
    const result = await ticketsService.validateAndCheckInTicket({
      qrTokenOrCode: body.qrTokenOrCode,
      staffUserId: req.user!.id,
      allowedCinemaIds: req.user!.managedCinemaIds,
      isPlatformAdmin: isAdmin,
    });
    res.json({ success: true, data: result });
  })
);

managerRouter.get(
  '/reports/occupancy',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.roles.includes('PLATFORM_ADMIN');
    const allowedCinemas = isAdmin ? null : req.user!.managedCinemaIds;

    if (allowedCinemas && allowedCinemas.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const params: any[] = [];
    const whereClause = allowedCinemas ? `WHERE s.cinema_id = ANY($1::uuid[])` : '';
    if (allowedCinemas) params.push(allowedCinemas);

    const reportRes = await db.query(
      `SELECT s.id as "showId", m.title as "movieTitle",
              c.name as "cinemaName", sc.name as "screenName",
              s.start_time as "startTime",
              COUNT(ss.id) FILTER (WHERE ss.status = 'BOOKED')::int as "bookedSeats",
              COUNT(ss.id) FILTER (WHERE ss.status = 'HELD')::int as "heldSeats",
              COUNT(ss.id) FILTER (WHERE ss.status != 'BLOCKED')::int as "totalCapacity",
              ROUND(
                (COUNT(ss.id) FILTER (WHERE ss.status = 'BOOKED')::numeric /
                 NULLIF(COUNT(ss.id) FILTER (WHERE ss.status != 'BLOCKED'), 0)) * 100,
                1
              )::float as "occupancyPercent"
       FROM shows s
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       LEFT JOIN show_seats ss ON ss.show_id = s.id
       ${whereClause}
       GROUP BY s.id, m.title, c.name, sc.name, s.start_time
       ORDER BY s.start_time ASC`,
      params
    );

    res.json({ success: true, data: reportRes.rows });
  })
);

managerRouter.get(
  '/reports/revenue',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.roles.includes('PLATFORM_ADMIN');
    const allowedCinemas = isAdmin ? null : req.user!.managedCinemaIds;

    if (allowedCinemas && allowedCinemas.length === 0) {
      res.json({
        success: true,
        data: { totalRevenue: 0, confirmedBookings: 0, ticketsSold: 0, byCinema: [] },
      });
      return;
    }

    const params: any[] = [];
    const whereClause = allowedCinemas
      ? `WHERE s.cinema_id = ANY($1::uuid[]) AND b.status = 'CONFIRMED'`
      : `WHERE b.status = 'CONFIRMED'`;
    if (allowedCinemas) params.push(allowedCinemas);

    const summaryRes = await db.query<{
      totalRevenue: number;
      confirmedBookings: number;
    }>(
      `SELECT COALESCE(SUM(b.total_amount), 0)::float as "totalRevenue",
              COUNT(b.id)::int as "confirmedBookings"
       FROM bookings b
       INNER JOIN shows s ON s.id = b.show_id
       ${whereClause}`,
      params
    );

    const byCinemaRes = await db.query(
      `SELECT c.id as "cinemaId", c.name as "cinemaName", c.city,
              COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'CONFIRMED'), 0)::float as revenue,
              COUNT(b.id) FILTER (WHERE b.status = 'CONFIRMED')::int as "confirmedBookings"
       FROM cinemas c
       LEFT JOIN shows s ON s.cinema_id = c.id
       LEFT JOIN bookings b ON b.show_id = s.id
       ${allowedCinemas ? 'WHERE c.id = ANY($1::uuid[])' : ''}
       GROUP BY c.id, c.name, c.city
       ORDER BY revenue DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        totalRevenue: summaryRes.rows[0]?.totalRevenue || 0,
        confirmedBookings: summaryRes.rows[0]?.confirmedBookings || 0,
        byCinema: byCinemaRes.rows,
      },
    });
  })
);

// ============================================================================
// PLATFORM ADMIN ROUTES (/api/v1/admin)
// ============================================================================

adminRouter.use(requireAuth, requireRoles('PLATFORM_ADMIN'));

adminRouter.post(
  '/movies',
  asyncHandler(async (req, res) => {
    const input = createMovieSchema.parse(req.body);
    const movie = await catalogService.createMovie(input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'PLATFORM_ADMIN',
      action: 'MOVIE_CREATED',
      entityType: 'MOVIE',
      entityId: movie.id,
      metadata: { title: movie.title },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: movie });
  })
);

adminRouter.patch(
  '/movies/:id',
  asyncHandler(async (req, res) => {
    const input = updateMovieSchema.parse(req.body);
    const movie = await catalogService.updateMovie(String(req.params.id), input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'PLATFORM_ADMIN',
      action: 'MOVIE_UPDATED',
      entityType: 'MOVIE',
      entityId: movie.id,
      metadata: input,
      ipAddress: req.ip,
    });
    res.json({ success: true, data: movie });
  })
);

adminRouter.post(
  '/cinemas',
  asyncHandler(async (req, res) => {
    const input = createCinemaSchema.parse(req.body);
    const cinema = await cinemasService.createCinema(input, req.user!.id);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'PLATFORM_ADMIN',
      action: 'ADMIN_CINEMA_ONBOARDED',
      entityType: 'CINEMA',
      entityId: cinema.id,
      cinemaId: cinema.id,
      metadata: { name: cinema.name, city: cinema.city },
      ipAddress: req.ip,
    });
    res.status(201).json({ success: true, data: cinema });
  })
);

adminRouter.patch(
  '/cinemas/:id',
  asyncHandler(async (req, res) => {
    const input = updateCinemaSchema.parse(req.body);
    const cinema = await cinemasService.updateCinema(String(req.params.id), input);
    await auditingService.record({
      actorUserId: req.user!.id,
      actorRole: 'PLATFORM_ADMIN',
      action: 'ADMIN_CINEMA_UPDATED',
      entityType: 'CINEMA',
      entityId: cinema.id,
      cinemaId: cinema.id,
      metadata: input,
      ipAddress: req.ip,
    });
    res.json({ success: true, data: cinema });
  })
);

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const usersRes = await db.query(
      `SELECT u.id, u.email, u.full_name as "fullName", u.phone,
              u.preferred_city as "preferredCity", u.status, u.created_at as "createdAt",
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT r.name), NULL) as roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: usersRes.rows });
  })
);

adminRouter.patch(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const targetUserId = String(req.params.id);
    const schema = z.object({
      status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      roles: z
        .array(
          z.enum(['CUSTOMER', 'CINEMA_STAFF', 'CINEMA_MANAGER', 'PLATFORM_ADMIN'])
        )
        .optional(),
      assignCinemaId: z.string().uuid().optional(),
    });
    const input = schema.parse(req.body);

    await db.withTransaction(async (tx) => {
      if (input.status) {
        await tx.query(
          `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
          [input.status, targetUserId]
        );
      }

      if (input.roles && input.roles.length > 0) {
        await tx.query(`DELETE FROM user_roles WHERE user_id = $1`, [targetUserId]);
        for (const rName of input.roles) {
          const rRes = await tx.query<{ id: number }>(
            `SELECT id FROM roles WHERE name = $1`,
            [rName]
          );
          if (rRes.rows[0]) {
            await tx.query(
              `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [targetUserId, rRes.rows[0].id]
            );
          }
        }
      }

      if (input.assignCinemaId) {
        await tx.query(
          `INSERT INTO cinema_staff (id, cinema_id, user_id, permission_role)
           VALUES ($1, $2, $3, 'CINEMA_MANAGER')
           ON CONFLICT (cinema_id, user_id) DO UPDATE SET permission_role = 'CINEMA_MANAGER'`,
          [crypto.randomUUID(), input.assignCinemaId, targetUserId]
        );
      }

      await auditingService.record(
        {
          actorUserId: req.user!.id,
          actorRole: 'PLATFORM_ADMIN',
          action: 'USER_STATUS_OR_ROLE_UPDATED',
          entityType: 'USER',
          entityId: targetUserId,
          metadata: input,
          ipAddress: req.ip,
        },
        tx
      );
    });

    res.json({ success: true, data: { id: targetUserId, updated: true } });
  })
);

adminRouter.get(
  '/bookings',
  asyncHandler(async (_req, res) => {
    const bookingsRes = await db.query(
      `SELECT b.id, b.booking_reference as "bookingReference", b.status,
              b.total_amount::float as "totalAmount", b.currency,
              b.created_at as "createdAt", b.confirmed_at as "confirmedAt",
              b.cancellation_reason as "cancellationReason",
              u.email as "customerEmail", u.full_name as "customerName",
              m.title as "movieTitle", c.name as "cinemaName", c.city as "cinemaCity",
              sc.name as "screenName", s.start_time as "startTime",
              t.ticket_code as "ticketCode", t.status as "ticketStatus"
       FROM bookings b
       INNER JOIN users u ON u.id = b.user_id
       INNER JOIN shows s ON s.id = b.show_id
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       LEFT JOIN tickets t ON t.booking_id = b.id
       ORDER BY b.created_at DESC
       LIMIT 200`
    );
    res.json({ success: true, data: bookingsRes.rows });
  })
);

adminRouter.get(
  '/payments',
  asyncHandler(async (_req, res) => {
    const paymentsRes = await db.query(
      `SELECT p.id, p.booking_id as "bookingId", b.booking_reference as "bookingReference",
              b.status as "bookingStatus", u.email as "customerEmail",
              p.provider, p.provider_intent_id as "providerIntentId",
              p.amount::float as amount, p.currency, p.status,
              p.payment_method as "paymentMethod", p.failure_reason as "failureReason",
              p.reconciliation_notes as "reconciliationNotes",
              p.completed_at as "completedAt", p.created_at as "createdAt"
       FROM payments p
       INNER JOIN bookings b ON b.id = p.booking_id
       INNER JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT 200`
    );
    res.json({ success: true, data: paymentsRes.rows });
  })
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const logs = await auditingService.listLogs({
      action: req.query.action as string | undefined,
      entityType: req.query.entityType as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    });
    res.json({ success: true, data: logs });
  })
);

adminRouter.get(
  '/reports/overview',
  asyncHandler(async (_req, res) => {
    const statsRes = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM movies WHERE release_status != 'ARCHIVED') as "activeMovies",
         (SELECT COUNT(*)::int FROM cinemas WHERE status = 'ACTIVE') as "activeCinemas",
         (SELECT COUNT(*)::int FROM screens) as "totalScreens",
         (SELECT COUNT(*)::int FROM shows WHERE status = 'PUBLISHED') as "publishedShows",
         (SELECT COUNT(*)::int FROM users) as "totalUsers",
         (SELECT COUNT(*)::int FROM bookings WHERE status = 'CONFIRMED') as "confirmedBookings",
         (SELECT COUNT(*)::int FROM bookings WHERE status = 'REFUND_REQUIRED') as "refundRequiredBookings",
         (SELECT COALESCE(SUM(total_amount), 0)::float FROM bookings WHERE status = 'CONFIRMED') as "grossRevenue",
         (SELECT COUNT(*)::int FROM show_seats WHERE status = 'BOOKED') as "totalSeatsBooked",
         (SELECT COUNT(*)::int FROM show_seats WHERE status = 'HELD') as "activeSeatsHeld",
         (SELECT COUNT(*)::int FROM outbox_events WHERE status = 'PENDING') as "pendingOutboxEvents"`
    );
    res.json({ success: true, data: statsRes.rows[0] });
  })
);

