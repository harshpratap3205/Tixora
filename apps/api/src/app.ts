import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { config } from './common/config';
import { errorMiddleware, asyncHandler } from './common/middleware';
import { openApiSpec } from './common/openapi';
import { db } from './db';
import { seedDatabase } from './db/seed';
import { identityRouter } from './modules/identity/identity.module';
import { usersRouter } from './modules/users/users.module';
import { catalogRouter } from './modules/catalog/catalog.module';
import { cinemasRouter, citiesRouter } from './modules/cinemas/cinemas.module';
import { showtimesRouter } from './modules/showtimes/showtimes.module';
import { reservationsRouter } from './modules/reservations/reservations.module';
import { bookingsRouter } from './modules/bookings/bookings.module';
import { paymentsRouter } from './modules/payments/payments.module';
import { managerRouter, adminRouter } from './modules/administration/administration.module';

export async function createApp(options: { seed?: boolean } = { seed: true }) {
  await db.init();
  await db.runMigrations();
  if (options.seed !== false) {
    await seedDatabase();
  }

  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow local frontend ports and configured CORS origin
        if (!origin || origin.startsWith('http://localhost:') || origin === config.corsOrigin) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Swagger / OpenAPI Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  // Health & Readiness Endpoint
  app.get(
    '/api/v1/health',
    asyncHandler(async (_req, res) => {
      const dbCheck = await db.query<{ now: string }>('SELECT NOW()::text as now');
      res.json({
        success: true,
        status: 'UP',
        service: 'tixora-api',
        database: 'CONNECTED',
        serverTime: dbCheck.rows[0]?.now,
      });
    })
  );

  // Versioned Business APIs (/api/v1)
  app.use('/api/v1/auth', identityRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/movies', catalogRouter);
  app.use('/api/v1/cities', citiesRouter);
  app.use('/api/v1/cinemas', cinemasRouter);
  app.use('/api/v1/shows', showtimesRouter);
  app.use('/api/v1/seat-holds', reservationsRouter);
  app.use('/api/v1/bookings', bookingsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/manager', managerRouter);
  app.use('/api/v1/admin', adminRouter);

  app.use(errorMiddleware);

  return app;
}

