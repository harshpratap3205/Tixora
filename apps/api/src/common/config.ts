import dotenv from 'dotenv';

dotenv.config();

console.log('Loaded environment variables from .env file',process.env.NODE_ENV,process.env.DATABASE_URL);
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ||
      'tixora_v1_production_grade_hmac_sha256_access_secret_key_2026',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'tixora_v1_production_grade_hmac_sha256_refresh_secret_key_2026',
    accessExpirySeconds: parseInt(process.env.JWT_ACCESS_EXPIRY_SECONDS || '3600', 10),
    refreshExpiryDays: parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7', 10),
  },
  qrSigningSecret:
    process.env.QR_SIGNING_SECRET ||
    'tixora_v1_qr_ticket_hmac_sha256_verification_secret_key_2026',
  holdDurationSeconds: parseInt(process.env.HOLD_DURATION_SECONDS || '480', 10),
  defaultTurnaroundMinutes: parseInt(process.env.TURNAROUND_MINUTES || '20', 10),
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'TIXORA_SANDBOX',
    webhookSecret:
      process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_tixora_sandbox_signature_secret_2026',
  },
};
