import { db, DbExecutor } from '../../db';

export class InventoryService {
  /**
   * Lazily and safely releases any expired seat holds so seat maps and reservation
   * checks always reflect true real-time availability even between scheduled ticks.
   */
  public async releaseExpiredHolds(tx?: DbExecutor): Promise<number> {
    const executor = tx || db;

    const expiredHolds = await executor.query<{ id: string }>(
      `UPDATE seat_holds
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE status = 'ACTIVE' AND expires_at <= NOW()
       RETURNING id`
    );

    if (expiredHolds.rows.length === 0) {
      return 0;
    }

    const holdIds = expiredHolds.rows.map((h) => h.id);

    for (const holdId of holdIds) {
      await executor.query(
        `UPDATE show_seats
         SET status = 'AVAILABLE',
             active_hold_id = NULL,
             hold_expires_at = NULL,
             version = version + 1,
             updated_at = NOW()
         WHERE active_hold_id = $1 AND status = 'HELD'`,
        [holdId]
      );

      // Mark any unconfirmed pending-payment booking linked to this expired hold as EXPIRED
      await executor.query(
        `UPDATE bookings
         SET status = 'EXPIRED',
             updated_at = NOW()
         WHERE hold_id = $1 AND status = 'PENDING_PAYMENT'`,
        [holdId]
      );
    }

    return holdIds.length;
  }

  public async getShowSeats(showId: string) {
    await this.releaseExpiredHolds();

    const seatsRes = await db.query(
      `SELECT id, show_id as "showId", seat_id as "seatId",
              seat_code as "seatCode", row_label as "rowLabel",
              seat_number as "seatNumber", category, seat_type as "seatType",
              grid_row as "gridRow", grid_col as "gridCol",
              price::float as price, currency, status,
              hold_expires_at as "holdExpiresAt"
       FROM show_seats
       WHERE show_id = $1
       ORDER BY grid_row ASC, grid_col ASC`,
      [showId]
    );

    return seatsRes.rows;
  }
}

export const inventoryService = new InventoryService();

