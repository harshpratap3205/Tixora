import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';
import { populateShowSeatsForShow } from '../../db/seed';
import { inventoryService } from '../inventory/inventory.module';

export const createShowSchema = z.object({
  movieId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  screenId: z.string().uuid(),
  language: z.string().min(2).default('English'),
  format: z.string().min(2).default('IMAX 2D'),
  startTime: z.string(),
  categoryPrices: z.record(z.string(), z.number().positive()),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
});

export const updateShowPricingSchema = z.object({
  categoryPrices: z.record(z.string(), z.number().positive()),
});

export class ShowtimesService {
  public async getShowDetails(showId: string) {
    await inventoryService.releaseExpiredHolds();

    const res = await db.query(
      `SELECT s.id, s.movie_id as "movieId", s.cinema_id as "cinemaId",
              s.screen_id as "screenId", s.language, s.format,
              s.start_time as "startTime", s.end_time as "endTime",
              s.turnaround_end_time as "turnaroundEndTime",
              s.currency, s.category_prices as "categoryPrices", s.status,
              m.title as "movieTitle", m.slug as "movieSlug",
              m.poster_url as "posterUrl", m.backdrop_url as "backdropUrl",
              m.duration_minutes as "durationMinutes", m.age_rating as "ageRating",
              c.name as "cinemaName", c.city as "cinemaCity",
              c.neighborhood as "cinemaNeighborhood", c.address as "cinemaAddress",
              sc.name as "screenName", sc.format_type as "screenFormat",
              sc.sound_system as "soundSystem",
              sc.total_rows as "totalRows", sc.total_cols as "totalCols"
       FROM shows s
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       WHERE s.id = $1`,
      [showId]
    );

    if (res.rows.length === 0) {
      throw AppError.notFound('Showtime not found');
    }
    return res.rows[0];
  }

  public async createShow(input: z.infer<typeof createShowSchema>) {
    const movieRes = await db.query<{ duration_minutes: number }>(
      'SELECT duration_minutes FROM movies WHERE id = $1',
      [input.movieId]
    );
    if (movieRes.rows.length === 0) {
      throw AppError.notFound('Movie not found');
    }

    const screenRes = await db.query<{ cinema_id: string; turnaround_minutes: number }>(
      'SELECT cinema_id, turnaround_minutes FROM screens WHERE id = $1',
      [input.screenId]
    );
    if (screenRes.rows.length === 0) {
      throw AppError.notFound('Screen not found');
    }

    if (screenRes.rows[0].cinema_id !== input.cinemaId) {
      throw AppError.badRequest('Selected screen does not belong to the specified cinema');
    }

    const start = new Date(input.startTime);
    if (isNaN(start.getTime())) {
      throw AppError.badRequest('Invalid startTime timestamp');
    }

    const durationMinutes = movieRes.rows[0].duration_minutes;
    const turnaroundMinutes = screenRes.rows[0].turnaround_minutes;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const turnaroundEnd = new Date(end.getTime() + turnaroundMinutes * 60 * 1000);

    // Check for overlapping showtimes on the same screen (including turnaround buffer)
    const overlapRes = await db.query<{ id: string; start_time: string; turnaround_end_time: string }>(
      `SELECT id, start_time, turnaround_end_time
       FROM shows
       WHERE screen_id = $1
         AND status != 'CANCELLED'
         AND start_time < $3
         AND turnaround_end_time > $2`,
      [input.screenId, start.toISOString(), turnaroundEnd.toISOString()]
    );

    if (overlapRes.rows.length > 0) {
      throw AppError.conflict(
        'Cannot schedule showtime: overlaps with an existing screening or turnaround interval on this screen',
        { conflictingShowId: overlapRes.rows[0].id }
      );
    }

    const showId = crypto.randomUUID();
    await db.query(
      `INSERT INTO shows (
        id, movie_id, cinema_id, screen_id, language, format,
        start_time, end_time, turnaround_end_time, currency, category_prices, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'INR',$10,$11)`,
      [
        showId,
        input.movieId,
        input.cinemaId,
        input.screenId,
        input.language,
        input.format,
        start.toISOString(),
        end.toISOString(),
        turnaroundEnd.toISOString(),
        JSON.stringify(input.categoryPrices),
        input.status,
      ]
    );

    await populateShowSeatsForShow(showId, input.screenId, input.categoryPrices);
    return this.getShowDetails(showId);
  }

  public async updateShowStatus(showId: string, status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED') {
    await this.getShowDetails(showId);
    await db.query(`UPDATE shows SET status = $1, updated_at = NOW() WHERE id = $2`, [
      status,
      showId,
    ]);
    return this.getShowDetails(showId);
  }

  public async updateShowPricing(
    showId: string,
    input: z.infer<typeof updateShowPricingSchema>
  ) {
    await this.getShowDetails(showId);
    await db.withTransaction(async (tx) => {
      await tx.query(
        `UPDATE shows SET category_prices = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(input.categoryPrices), showId]
      );

      // Update AVAILABLE seats only; preserve historically held or booked seat prices
      for (const [category, price] of Object.entries(input.categoryPrices)) {
        await tx.query(
          `UPDATE show_seats
           SET price = $1, updated_at = NOW()
           WHERE show_id = $2 AND category = $3 AND status = 'AVAILABLE'`,
          [price, showId, category]
        );
      }
    });

    return this.getShowDetails(showId);
  }
}

export const showtimesService = new ShowtimesService();
export const showtimesRouter = Router();

showtimesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const show = await showtimesService.getShowDetails(req.params.id);
    res.json({ success: true, data: show });
  })
);

showtimesRouter.get(
  '/:id/seats',
  asyncHandler(async (req, res) => {
    const show = await showtimesService.getShowDetails(req.params.id);
    const seats = await inventoryService.getShowSeats(req.params.id);
    res.json({
      success: true,
      data: {
        show,
        seats,
      },
    });
  })
);
