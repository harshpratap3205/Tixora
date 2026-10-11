import { createApp } from './app';
import { config } from './common/config';
import { logger } from './common/logger';
import { notificationsAndJobsService } from './modules/notifications/notifications.module';

async function bootstrap() {
  try {
    const app = await createApp({ seed: true });
    notificationsAndJobsService.startBackgroundWorkers(15000);

    app.listen(config.port, () => {
      logger.info(
        `Tixora API running at http://localhost:${config.port}/api/v1 (Docs: http://localhost:${config.port}/api-docs)`
      );
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start Tixora API server');
    process.exit(1);
  }
}

bootstrap();

