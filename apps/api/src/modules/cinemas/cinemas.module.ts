import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';

export const createCinemaSchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().min(2).max(100),
  neighborhood: z.string().min(2).max(120),
  address: z.string().min(5),
  facilities: z.array(z.string()).default(['Dolby Atmos', 'Laser Projection']),
  status: z.enum(['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED']).default('ACTIVE'),
});

export const updateCinemaSchema = createCinemaSchema.partial();

export class CinemasService {
  public async listCities() {
    const res = await db.query<{ city: string; cinemaCount: number }>(
      `SELECT city, COUNT(*)::int as "cinemaCount"
       FROM cinemas
       WHERE status = 'ACTIVE'
       GROUP BY city
       ORDER BY city ASC`
    );
    return res.rows;
  }

  public async listCinemas(params: { city?: string; search?: string; includeAll?: boolean }) {
    const conditions: string[] = [];
    const values: any[] = [];

    if (!params.includeAll) {
      conditions.push(`c.status = 'ACTIVE'`);
    }
    if (params.city) {
      values.push(params.city);
      conditions.push(`LOWER(c.city) = LOWER($${values.length})`);
    }
    if (params.search) {
      values.push(`%${params.search.toLowerCase()}%`);
      conditions.push(`(LOWER(c.name) LIKE $${values.length} OR LOWER(c.neighborhood) LIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await db.query(
      `SELECT c.id, c.name, c.slug, c.city, c.neighborhood, c.address,
              c.facilities, c.status, c.timezone, c.created_at as "createdAt",
              (SELECT COUNT(*)::int FROM screens sc WHERE sc.cinema_id = c.id) as "screenCount"
       FROM cinemas c
       ${whereClause}
       ORDER BY c.city ASC, c.name ASC`,
      values
    );
    return res.rows;
  }

  public async getCinemaById(id: string) {
    const res = await db.query(
      `SELECT c.id, c.name, c.slug, c.city, c.neighborhood, c.address,
              c.facilities, c.status, c.timezone, c.created_at as "createdAt"
       FROM cinemas c WHERE c.id = $1`,
      [id]
    );
    if (res.rows.length === 0) {
      throw AppError.notFound('Cinema not found');
    }

    const screensRes = await db.query(
      `SELECT id, cinema_id as "cinemaId", name, format_type as "formatType",
              sound_system as "soundSystem", total_rows as "totalRows",
              total_cols as "totalCols", turnaround_minutes as "turnaroundMinutes",
              layout_version as "layoutVersion"
       FROM screens WHERE cinema_id = $1 ORDER BY name ASC`,
      [id]
    );

    const showsRes = await db.query(
      `SELECT s.id, s.movie_id as "movieId", s.screen_id as "screenId",
              s.language, s.format, s.start_time as "startTime", s.end_time as "endTime",
              s.category_prices as "categoryPrices", s.status,
              m.title as "movieTitle", m.poster_url as "posterUrl",
              m.duration_minutes as "durationMinutes", m.age_rating as "ageRating",
              sc.name as "screenName",
              (SELECT COUNT(*)::int FROM show_seats ss WHERE ss.show_id = s.id AND ss.status = 'AVAILABLE') as "availableSeats",
              (SELECT COUNT(*)::int FROM show_seats ss WHERE ss.show_id = s.id AND ss.status != 'BLOCKED') as "totalSeats"
       FROM shows s
       INNER JOIN movies m ON m.id = s.movie_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       WHERE s.cinema_id = $1 AND s.status = 'PUBLISHED'
       ORDER BY s.start_time ASC`,
      [id]
    );

    return {
      ...res.rows[0],
      screens: screensRes.rows,
      shows: showsRes.rows,
    };
  }

  public async createCinema(input: z.infer<typeof createCinemaSchema>, creatorUserId?: string) {
    const id = crypto.randomUUID();
    const slug = `${input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${id.slice(0, 6)}`;

    await db.withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO cinemas (id, name, slug, city, neighborhood, address, facilities, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          input.name,
          slug,
          input.city,
          input.neighborhood,
          input.address,
          input.facilities,
          input.status,
        ]
      );

      if (creatorUserId) {
        await tx.query(
          `INSERT INTO cinema_staff (id, cinema_id, user_id, permission_role)
           VALUES ($1, $2, $3, 'CINEMA_MANAGER') ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), id, creatorUserId]
        );
      }
    });

    return this.getCinemaById(id);
  }

  public async updateCinema(id: string, input: z.infer<typeof updateCinemaSchema>) {
    await this.getCinemaById(id);
    await db.query(
      `UPDATE cinemas
       SET name = COALESCE($1, name),
           city = COALESCE($2, city),
           neighborhood = COALESCE($3, neighborhood),
           address = COALESCE($4, address),
           facilities = COALESCE($5, facilities),
           status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $7`,
      [
        input.name ?? null,
        input.city ?? null,
        input.neighborhood ?? null,
        input.address ?? null,
        input.facilities ?? null,
        input.status ?? null,
        id,
      ]
    );
    return this.getCinemaById(id);
  }
}

export const cinemasService = new CinemasService();
export const cinemasRouter = Router();
export const citiesRouter = Router();

citiesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cities = await cinemasService.listCities();
    res.json({ success: true, data: cities });
  })
);

cinemasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const cinemas = await cinemasService.listCinemas({
      city: req.query.city as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data: cinemas });
  })
);

cinemasRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cinema = await cinemasService.getCinemaById(req.params.id);
    res.json({ success: true, data: cinema });
  })
);
