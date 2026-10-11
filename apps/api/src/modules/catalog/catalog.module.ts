import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';

export const createMovieSchema = z.object({
  title: z.string().min(1).max(220),
  tagline: z.string().max(255).optional(),
  synopsis: z.string().min(10),
  durationMinutes: z.number().int().positive(),
  releaseDate: z.string(),
  releaseStatus: z.enum(['NOW_SHOWING', 'UPCOMING', 'ARCHIVED']).default('NOW_SHOWING'),
  ageRating: z.string().default('UA 16+'),
  languages: z.array(z.string()).min(1),
  genres: z.array(z.string()).min(1),
  director: z.string().min(2),
  castMembers: z
    .array(z.object({ name: z.string(), role: z.string() }))
    .default([]),
  posterUrl: z.string().url(),
  backdropUrl: z.string().url(),
  trailerUrl: z.string().url().optional(),
  imdbRating: z.number().min(1).max(10).default(8.2),
  isFeatured: z.boolean().default(false),
});

export const updateMovieSchema = createMovieSchema.partial();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export class CatalogService {
  public async listMovies(params: {
    search?: string;
    language?: string;
    genre?: string;
    status?: string;
    featured?: boolean;
    city?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.search) {
      values.push(`%${params.search.toLowerCase()}%`);
      conditions.push(`(LOWER(m.title) LIKE $${values.length} OR LOWER(m.director) LIKE $${values.length})`);
    }
    if (params.language) {
      values.push(params.language);
      conditions.push(`$${values.length} = ANY(m.languages)`);
    }
    if (params.genre) {
      values.push(params.genre);
      conditions.push(`$${values.length} = ANY(m.genres)`);
    }
    if (params.status) {
      values.push(params.status);
      conditions.push(`m.release_status = $${values.length}`);
    } else {
      conditions.push(`m.release_status != 'ARCHIVED'`);
    }
    if (params.featured !== undefined) {
      values.push(params.featured);
      conditions.push(`m.is_featured = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    let orderBy = 'm.is_featured DESC, m.imdb_rating DESC, m.release_date DESC';
    if (params.sort === 'release_date') orderBy = 'm.release_date DESC';
    if (params.sort === 'rating') orderBy = 'm.imdb_rating DESC';
    if (params.sort === 'title') orderBy = 'm.title ASC';

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM movies m ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const queryValues = [...values, limit, offset];
    const res = await db.query(
      `SELECT m.id, m.slug, m.title, m.tagline, m.synopsis,
              m.duration_minutes as "durationMinutes",
              m.release_date as "releaseDate",
              m.release_status as "releaseStatus",
              m.age_rating as "ageRating",
              m.languages, m.genres, m.director,
              m.cast_members as "castMembers",
              m.poster_url as "posterUrl",
              m.backdrop_url as "backdropUrl",
              m.trailer_url as "trailerUrl",
              m.imdb_rating::float as "imdbRating",
              m.is_featured as "isFeatured",
              m.created_at as "createdAt"
       FROM movies m
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}`,
      queryValues
    );

    return {
      items: res.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public async getMovieByIdOrSlug(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const res = await db.query(
      `SELECT m.id, m.slug, m.title, m.tagline, m.synopsis,
              m.duration_minutes as "durationMinutes",
              m.release_date as "releaseDate",
              m.release_status as "releaseStatus",
              m.age_rating as "ageRating",
              m.languages, m.genres, m.director,
              m.cast_members as "castMembers",
              m.poster_url as "posterUrl",
              m.backdrop_url as "backdropUrl",
              m.trailer_url as "trailerUrl",
              m.imdb_rating::float as "imdbRating",
              m.is_featured as "isFeatured",
              m.created_at as "createdAt"
       FROM movies m
       WHERE ${isUuid ? 'm.id = $1' : 'm.slug = $1'}`,
      [idOrSlug]
    );

    if (res.rows.length === 0) {
      throw AppError.notFound('Movie not found');
    }
    return res.rows[0];
  }

  public async getMovieShowtimes(movieIdOrSlug: string, city?: string, date?: string) {
    const movie = await this.getMovieByIdOrSlug(movieIdOrSlug);
    const conditions: string[] = [`s.movie_id = $1`, `s.status = 'PUBLISHED'`];
    const values: any[] = [movie.id];

    if (city) {
      values.push(city);
      conditions.push(`LOWER(c.city) = LOWER($${values.length})`);
    }
    if (date) {
      values.push(date);
      conditions.push(`DATE(s.start_time) = DATE($${values.length})`);
    }

    const res = await db.query(
      `SELECT s.id, s.movie_id as "movieId", s.cinema_id as "cinemaId",
              s.screen_id as "screenId", s.language, s.format,
              s.start_time as "startTime", s.end_time as "endTime",
              s.currency, s.category_prices as "categoryPrices", s.status,
              c.name as "cinemaName", c.city as "cinemaCity",
              c.neighborhood as "cinemaNeighborhood", c.address as "cinemaAddress",
              c.facilities as "cinemaFacilities",
              sc.name as "screenName", sc.format_type as "screenFormat",
              sc.sound_system as "soundSystem",
              (SELECT COUNT(*)::int FROM show_seats ss WHERE ss.show_id = s.id AND ss.status = 'AVAILABLE') as "availableSeats",
              (SELECT COUNT(*)::int FROM show_seats ss WHERE ss.show_id = s.id AND ss.status != 'BLOCKED') as "totalSeats"
       FROM shows s
       INNER JOIN cinemas c ON c.id = s.cinema_id
       INNER JOIN screens sc ON sc.id = s.screen_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.start_time ASC`,
      values
    );

    return {
      movie,
      shows: res.rows,
    };
  }

  public async createMovie(input: z.infer<typeof createMovieSchema>) {
    const id = crypto.randomUUID();
    const slug = `${slugify(input.title)}-${id.slice(0, 6)}`;
    await db.query(
      `INSERT INTO movies (
        id, slug, title, tagline, synopsis, duration_minutes, release_date,
        release_status, age_rating, languages, genres, director, cast_members,
        poster_url, backdrop_url, trailer_url, imdb_rating, is_featured
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        id,
        slug,
        input.title,
        input.tagline || null,
        input.synopsis,
        input.durationMinutes,
        input.releaseDate,
        input.releaseStatus,
        input.ageRating,
        input.languages,
        input.genres,
        input.director,
        JSON.stringify(input.castMembers || []),
        input.posterUrl,
        input.backdropUrl,
        input.trailerUrl || null,
        input.imdbRating,
        input.isFeatured,
      ]
    );
    return this.getMovieByIdOrSlug(id);
  }

  public async updateMovie(id: string, input: z.infer<typeof updateMovieSchema>) {
    const existing = await this.getMovieByIdOrSlug(id);
    await db.query(
      `UPDATE movies
       SET title = COALESCE($1, title),
           tagline = COALESCE($2, tagline),
           synopsis = COALESCE($3, synopsis),
           duration_minutes = COALESCE($4, duration_minutes),
           release_date = COALESCE($5, release_date),
           release_status = COALESCE($6, release_status),
           age_rating = COALESCE($7, age_rating),
           languages = COALESCE($8, languages),
           genres = COALESCE($9, genres),
           director = COALESCE($10, director),
           poster_url = COALESCE($11, poster_url),
           backdrop_url = COALESCE($12, backdrop_url),
           trailer_url = COALESCE($13, trailer_url),
           imdb_rating = COALESCE($14, imdb_rating),
           is_featured = COALESCE($15, is_featured),
           updated_at = NOW()
       WHERE id = $16`,
      [
        input.title ?? null,
        input.tagline ?? null,
        input.synopsis ?? null,
        input.durationMinutes ?? null,
        input.releaseDate ?? null,
        input.releaseStatus ?? null,
        input.ageRating ?? null,
        input.languages ?? null,
        input.genres ?? null,
        input.director ?? null,
        input.posterUrl ?? null,
        input.backdropUrl ?? null,
        input.trailerUrl ?? null,
        input.imdbRating ?? null,
        input.isFeatured ?? null,
        existing.id,
      ]
    );
    return this.getMovieByIdOrSlug(existing.id);
  }
}

export const catalogService = new CatalogService();
export const catalogRouter = Router();

catalogRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await catalogService.listMovies({
      search: req.query.search as string | undefined,
      language: req.query.language as string | undefined,
      genre: req.query.genre as string | undefined,
      status: req.query.status as string | undefined,
      featured: req.query.featured !== undefined ? req.query.featured === 'true' : undefined,
      sort: req.query.sort as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    });
    res.json({ success: true, data: result.items, pagination: result.pagination });
  })
);

catalogRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const movie = await catalogService.getMovieByIdOrSlug(String(req.params.id));
    res.json({ success: true, data: movie });
  })
);

catalogRouter.get(
  '/:id/shows',
  asyncHandler(async (req, res) => {
    const result = await catalogService.getMovieShowtimes(
      String(req.params.id),
      req.query.city as string | undefined,
      req.query.date as string | undefined
    );
    res.json({ success: true, data: result });
  })
);

