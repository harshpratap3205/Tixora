import crypto from 'crypto';
import { db, DbExecutor } from '../../db';

export interface AuditLogInput {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  cinemaId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export class AuditingService {
  public async record(input: AuditLogInput, tx?: DbExecutor): Promise<void> {
    const executor = tx || db;
    await executor.query(
      `INSERT INTO audit_logs (
        id, actor_user_id, actor_role, action, entity_type, entity_id, cinema_id, metadata, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        crypto.randomUUID(),
        input.actorUserId || null,
        input.actorRole || null,
        input.action,
        input.entityType,
        input.entityId,
        input.cinemaId || null,
        JSON.stringify(input.metadata || {}),
        input.ipAddress || null,
      ]
    );
  }

  public async listLogs(params: {
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit || 50, 200);
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.action) {
      values.push(params.action);
      conditions.push(`a.action = $${values.length}`);
    }
    if (params.entityType) {
      values.push(params.entityType);
      conditions.push(`a.entity_type = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit, offset);

    const res = await db.query(
      `SELECT a.id, a.actor_user_id, u.email as actor_email, u.full_name as actor_name,
              a.actor_role, a.action, a.entity_type, a.entity_id, a.cinema_id,
              a.metadata, a.ip_address, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return res.rows;
  }
}

export const auditingService = new AuditingService();

