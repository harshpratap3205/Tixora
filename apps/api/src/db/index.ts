import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../common/config';
import { logger } from '../common/logger';

export interface QueryResult<T = Record<string, any>> {
  rows: T[];
  rowCount: number;
}

export interface DbExecutor {
  query<T = Record<string, any>>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}

class DatabaseManager {
  private pgPool: Pool | null = null;
  private pglite: PGlite | null = null;
  private initialized = false;
  private txMutex: Promise<void> = Promise.resolve();

  public async init(): Promise<void> {
    if (this.initialized) return;

    if (config.databaseUrl) {
      logger.info('Connecting to external PostgreSQL via DATABASE_URL');
      this.pgPool = new Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      await this.pgPool.query('SELECT 1');
    } else {
      logger.info('Using embedded PostgreSQL 16 engine (PGlite) for zero-config execution');
      this.pglite = new PGlite();
      await this.pglite.waitReady;
    }

    this.initialized = true;
  }

  public async query<T = Record<string, any>>(
    sql: string,
    params: any[] = []
  ): Promise<QueryResult<T>> {
    if (!this.initialized) {
      await this.init();
    }

    if (this.pgPool) {
      const res = await this.pgPool.query(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length,
      };
    }

    if (this.pglite) {
      const res = await this.pglite.query<T>(sql, params);
      return {
        rows: res.rows,
        rowCount: res.affectedRows ?? res.rows.length,
      };
    }

    throw new Error('Database not initialized');
  }

  public async execSql(sql: string): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    if (this.pgPool) {
      await this.pgPool.query(sql);
      return;
    }
    if (this.pglite) {
      await this.pglite.exec(sql);
      return;
    }
  }

  public async withTransaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
    if (!this.initialized) {
      await this.init();
    }

    if (this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const executor: DbExecutor = {
          query: async <R = Record<string, any>>(sql: string, params: any[] = []) => {
            const res = await client.query(sql, params);
            return {
              rows: res.rows as R[],
              rowCount: res.rowCount ?? res.rows.length,
            };
          },
        };
        const result = await fn(executor);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // For single-connection PGlite, serialize transactions with an async mutex
    // so concurrent requests execute atomic BEGIN...COMMIT/ROLLBACK transactions cleanly
    let releaseMutex!: () => void;
    const prevMutex = this.txMutex;
    this.txMutex = new Promise<void>((resolve) => {
      releaseMutex = resolve;
    });

    await prevMutex;
    try {
      await this.pglite!.query('BEGIN');
      const executor: DbExecutor = {
        query: async <R = Record<string, any>>(sql: string, params: any[] = []) => {
          const res = await this.pglite!.query<R>(sql, params);
          return {
            rows: res.rows,
            rowCount: res.affectedRows ?? res.rows.length,
          };
        },
      };
      const result = await fn(executor);
      await this.pglite!.query('COMMIT');
      return result;
    } catch (err) {
      await this.pglite!.query('ROLLBACK');
      throw err;
    } finally {
      releaseMutex();
    }
  }

  public async runMigrations(): Promise<void> {
    const migrationPath = path.join(__dirname, 'migrations', 'V1__init_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await this.execSql(sql);
    logger.info('Executed V1__init_schema.sql database migration successfully');
  }
}

export const db = new DatabaseManager();
