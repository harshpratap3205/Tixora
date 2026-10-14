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
console.log('DatabaseManager: Initializing database connection...',config.databaseUrl);
    if (config.databaseUrl) {
      try {
        const isLocal =
          config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1');
        logger.info(`Connecting to external PostgreSQL (SSL: ${!isLocal})`);
        this.pgPool = new Pool({
          connectionString: config.databaseUrl,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 7000,
        });
        await this.pgPool.query('SELECT 1');
      } catch (err) {
        logger.warn(
          { err },
          'Failed to connect to external PostgreSQL; falling back to embedded PGlite engine'
        );
        this.pgPool = null;
        this.pglite = new PGlite();
        await this.pglite.waitReady;
      }
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
    const possiblePaths = [
      path.join(__dirname, 'migrations', 'V1__init_schema.sql'),
      path.join(__dirname, '..', 'src', 'db', 'migrations', 'V1__init_schema.sql'),
      path.join(__dirname, '..', '..', 'src', 'db', 'migrations', 'V1__init_schema.sql'),
      path.join(process.cwd(), 'apps', 'api', 'src', 'db', 'migrations', 'V1__init_schema.sql'),
      path.join(process.cwd(), 'src', 'db', 'migrations', 'V1__init_schema.sql'),
    ];
    const migrationPath = possiblePaths.find((p) => fs.existsSync(p));
    if (!migrationPath) {
      throw new Error(
        `Database migration file V1__init_schema.sql not found in paths: ${possiblePaths.join(', ')}`
      );
    }
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    await this.execSql(sql);
    logger.info(`Executed ${migrationPath} database migration successfully`);
  }
}

export const db = new DatabaseManager();
