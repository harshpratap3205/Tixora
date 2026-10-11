import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.env === 'test' ? 'silent' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'accessToken',
      'refreshToken',
      'clientSecret',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'tixora-api',
    env: config.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
