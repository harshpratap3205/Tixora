import { db } from '../../db';
import { logger } from '../../common/logger';
import { inventoryService } from '../inventory/inventory.module';

export class NotificationsAndJobsService {
  private intervalHandle: NodeJS.Timeout | null = null;

  public async processOutboxEvents(): Promise<number> {
    const pendingRes = await db.query<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      attempts: number;
    }>(
      `SELECT id, event_type, payload, attempts
       FROM outbox_events
       WHERE status = 'PENDING' AND attempts < 5
       ORDER BY created_at ASC
       LIMIT 25`
    );

    let processedCount = 0;
    for (const evt of pendingRes.rows) {
      try {
        logger.info(
          { eventId: evt.id, eventType: evt.event_type, payload: evt.payload },
          'Dispatched transactional outbox notification'
        );
        await db.query(
          `UPDATE outbox_events
           SET status = 'PROCESSED',
               attempts = attempts + 1,
               processed_at = NOW()
           WHERE id = $1`,
          [evt.id]
        );
        processedCount++;
      } catch (err) {
        await db.query(
          `UPDATE outbox_events
           SET attempts = attempts + 1,
               last_error = $1,
               status = CASE WHEN attempts + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END
           WHERE id = $2`,
          [err instanceof Error ? err.message : 'Unknown error', evt.id]
        );
      }
    }

    return processedCount;
  }

  public async reconcileRefundPendingPayments(): Promise<number> {
    const res = await db.query<{ id: string; booking_id: string }>(
      `UPDATE payments
       SET status = 'REFUNDED',
           reconciliation_notes = COALESCE(reconciliation_notes, '') || ' [Auto-reconciled refund completed]',
           updated_at = NOW()
       WHERE status = 'REFUND_PENDING'
         AND updated_at < NOW() - INTERVAL '5 minutes'
       RETURNING id, booking_id`
    );

    for (const row of res.rows) {
      await db.query(
        `UPDATE bookings SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1`,
        [row.booking_id]
      );
    }

    return res.rows.length;
  }

  public startBackgroundWorkers(intervalMs = 15000): void {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(async () => {
      try {
        await inventoryService.releaseExpiredHolds();
        await this.processOutboxEvents();
        await this.reconcileRefundPendingPayments();
      } catch (err) {
        logger.error({ err }, 'Error in background maintenance worker');
      }
    }, intervalMs);
    this.intervalHandle.unref();
  }

  public stopBackgroundWorkers(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

export const notificationsAndJobsService = new NotificationsAndJobsService();

