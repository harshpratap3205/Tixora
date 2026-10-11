import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../../db';
import { AppError } from '../../common/errors';
import { generateSeatsForScreen } from '../../db/seed';

export const createScreenSchema = z.object({
  name: z.string().min(2).max(100),
  formatType: z.string().default('IMAX Laser'),
  soundSystem: z.string().default('Dolby Atmos'),
  totalRows: z.number().int().min(3).max(20).default(7),
  totalCols: z.number().int().min(4).max(24).default(12),
  turnaroundMinutes: z.number().int().min(0).max(120).default(20),
});

export const updateSeatLayoutSchema = z.object({
  seats: z
    .array(
      z.object({
        seatCode: z.string(),
        category: z.enum(['STANDARD', 'PRIME', 'RECLINER', 'IMAX_VIP']).optional(),
        seatType: z
          .enum(['REGULAR', 'ACCESSIBLE', 'COUPLE', 'AISLE_GAP', 'DISABLED'])
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .min(1),
});

export class ScreensService {
  public async getScreenWithSeats(screenId: string) {
    const scRes = await db.query(
      `SELECT id, cinema_id as "cinemaId", name, format_type as "formatType",
              sound_system as "soundSystem", total_rows as "totalRows",
              total_cols as "totalCols", turnaround_minutes as "turnaroundMinutes",
              layout_version as "layoutVersion"
       FROM screens WHERE id = $1`,
      [screenId]
    );
    if (scRes.rows.length === 0) {
      throw AppError.notFound('Screen not found');
    }

    const seatsRes = await db.query(
      `SELECT id, seat_code as "seatCode", row_label as "rowLabel",
              seat_number as "seatNumber", category, seat_type as "seatType",
              grid_row as "gridRow", grid_col as "gridCol", is_active as "isActive"
       FROM seats WHERE screen_id = $1 ORDER BY grid_row ASC, grid_col ASC`,
      [screenId]
    );

    return {
      ...scRes.rows[0],
      seats: seatsRes.rows,
    };
  }

  public async createScreen(cinemaId: string, input: z.infer<typeof createScreenSchema>) {
    const screenId = crypto.randomUUID();
    await db.query(
      `INSERT INTO screens (
        id, cinema_id, name, format_type, sound_system, total_rows, total_cols, turnaround_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        screenId,
        cinemaId,
        input.name,
        input.formatType,
        input.soundSystem,
        input.totalRows,
        input.totalCols,
        input.turnaroundMinutes,
      ]
    );

    await generateSeatsForScreen(screenId, input.totalRows, input.totalCols);
    return this.getScreenWithSeats(screenId);
  }

  public async updateScreenSeats(
    screenId: string,
    input: z.infer<typeof updateSeatLayoutSchema>
  ) {
    const screen = await this.getScreenWithSeats(screenId);

    // Protect already-sold or held inventory on active shows
    for (const item of input.seats) {
      if (item.isActive === false || item.seatType === 'DISABLED') {
        const soldRes = await db.query<{ count: string }>(
          `SELECT COUNT(*)::text as count
           FROM show_seats ss
           INNER JOIN shows s ON s.id = ss.show_id
           WHERE s.screen_id = $1
             AND ss.seat_code = $2
             AND ss.status IN ('HELD', 'BOOKED')`,
          [screenId, item.seatCode]
        );
        if (parseInt(soldRes.rows[0]?.count || '0', 10) > 0) {
          throw AppError.conflict(
            `Cannot disable seat ${item.seatCode} because it has active holds or confirmed bookings.`
          );
        }
      }
    }

    await db.withTransaction(async (tx) => {
      for (const item of input.seats) {
        await tx.query(
          `UPDATE seats
           SET category = COALESCE($1, category),
               seat_type = COALESCE($2, seat_type),
               is_active = COALESCE($3, is_active)
           WHERE screen_id = $4 AND seat_code = $5`,
          [
            item.category ?? null,
            item.seatType ?? null,
            item.isActive ?? null,
            screenId,
            item.seatCode,
          ]
        );
      }

      await tx.query(
        `UPDATE screens SET layout_version = layout_version + 1, updated_at = NOW() WHERE id = $1`,
        [screenId]
      );
    });

    return this.getScreenWithSeats(screen.id);
  }
}

export const screensService = new ScreensService();
