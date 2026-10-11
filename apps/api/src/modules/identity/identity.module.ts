import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { config } from '../../common/config';
import { AppError } from '../../common/errors';
import { asyncHandler } from '../../common/middleware';
import { auditingService } from '../auditing/auditing.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  managedCinemaIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2).max(120),
  phone: z.string().optional(),
  preferredCity: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export class IdentityService {
  public async getUserAuthContext(userId: string): Promise<AuthenticatedUser> {
    const userRes = await db.query<{
      id: string;
      email: string;
      full_name: string;
      status: string;
    }>('SELECT id, email, full_name, status FROM users WHERE id = $1', [userId]);

    if (userRes.rows.length === 0) {
      throw AppError.unauthorized('User account no longer exists');
    }

    const user = userRes.rows[0];
    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden('Account is suspended');
    }

    const rolesRes = await db.query<{ name: string }>(
      `SELECT r.name FROM roles r
       INNER JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId]
    );

    const staffRes = await db.query<{ cinema_id: string }>(
      `SELECT cinema_id FROM cinema_staff WHERE user_id = $1`,
      [userId]
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      roles: rolesRes.rows.map((r) => r.name),
      managedCinemaIds: staffRes.rows.map((s) => s.cinema_id),
    };
  }

  public issueTokens(user: AuthenticatedUser) {
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles,
        managedCinemaIds: user.managedCinemaIds,
      },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpirySeconds }
    );

    const refreshToken = crypto.randomBytes(48).toString('hex');
    return { accessToken, refreshToken };
  }

  public async register(input: z.infer<typeof registerSchema>, ipAddress?: string, userAgent?: string) {
    const email = input.email.toLowerCase().trim();
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw AppError.conflict('An account with this email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const userId = crypto.randomUUID();

    await db.withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, email, password_hash, full_name, phone, preferred_city, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')`,
        [
          userId,
          email,
          passwordHash,
          input.fullName.trim(),
          input.phone || null,
          input.preferredCity || 'Mumbai',
        ]
      );

      const roleRes = await tx.query<{ id: number }>(
        `SELECT id FROM roles WHERE name = 'CUSTOMER'`
      );
      if (roleRes.rows[0]) {
        await tx.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
          [userId, roleRes.rows[0].id]
        );
      }

      await auditingService.record(
        {
          actorUserId: userId,
          actorRole: 'CUSTOMER',
          action: 'USER_REGISTERED',
          entityType: 'USER',
          entityId: userId,
          metadata: { email },
          ipAddress,
        },
        tx
      );
    });

    const authUser = await this.getUserAuthContext(userId);
    const tokens = await this.createSession(authUser, ipAddress, userAgent);
    return { user: authUser, ...tokens };
  }

  public async login(input: z.infer<typeof loginSchema>, ipAddress?: string, userAgent?: string) {
    const email = input.email.toLowerCase().trim();
    const userRes = await db.query<{
      id: string;
      password_hash: string;
      status: string;
    }>('SELECT id, password_hash, status FROM users WHERE email = $1', [email]);

    if (userRes.rows.length === 0) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const userRow = userRes.rows[0];
    if (userRow.status !== 'ACTIVE') {
      throw AppError.forbidden('This account has been suspended');
    }

    const valid = await bcrypt.compare(input.password, userRow.password_hash);
    if (!valid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const authUser = await this.getUserAuthContext(userRow.id);
    const tokens = await this.createSession(authUser, ipAddress, userAgent);
    return { user: authUser, ...tokens };
  }

  public async createSession(user: AuthenticatedUser, ipAddress?: string, userAgent?: string) {
    const { accessToken, refreshToken } = this.issueTokens(user);
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000
    );

    await db.query(
      `INSERT INTO refresh_sessions (id, user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sessionId,
        user.id,
        hashToken(refreshToken),
        userAgent || null,
        ipAddress || null,
        expiresAt.toISOString(),
      ]
    );

    return { accessToken, refreshToken, expiresIn: config.jwt.accessExpirySeconds };
  }

  public async refreshSession(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Missing refresh token');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const sessionRes = await db.query<{
      id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
    }>(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_sessions WHERE token_hash = $1`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      throw AppError.unauthorized('Invalid refresh session');
    }

    const session = sessionRes.rows[0];
    if (session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
      throw AppError.unauthorized('Refresh session expired or revoked');
    }

    const authUser = await this.getUserAuthContext(session.user_id);
    const { accessToken, refreshToken: newRefreshToken } = this.issueTokens(authUser);
    const newSessionId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000
    );

    await db.withTransaction(async (tx) => {
      await tx.query(
        `UPDATE refresh_sessions
         SET revoked_at = NOW(), replaced_by_session_id = $1
         WHERE id = $2`,
        [newSessionId, session.id]
      );
      await tx.query(
        `INSERT INTO refresh_sessions (id, user_id, token_hash, user_agent, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newSessionId,
          authUser.id,
          hashToken(newRefreshToken),
          userAgent || null,
          ipAddress || null,
          expiresAt.toISOString(),
        ]
      );
    });

    return {
      user: authUser,
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.jwt.accessExpirySeconds,
    };
  }

  public async logout(rawRefreshToken?: string, userId?: string) {
    if (rawRefreshToken) {
      await db.query(
        `UPDATE refresh_sessions SET revoked_at = NOW() WHERE token_hash = $1`,
        [hashToken(rawRefreshToken)]
      );
    } else if (userId) {
      await db.query(
        `UPDATE refresh_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );
    }
  }
}

export const identityService = new IdentityService();

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(AppError.unauthorized('Bearer token is required'));
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as {
      sub: string;
      email: string;
      fullName: string;
      roles: string[];
      managedCinemaIds: string[];
    };
    req.user = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      roles: payload.roles || [],
      managedCinemaIds: payload.managedCinemaIds || [],
    };
    next();
  } catch (_err) {
    next(AppError.unauthorized('Invalid or expired access token'));
  }
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      next(
        AppError.forbidden(
          `Requires one of the following roles: ${allowedRoles.join(', ')}`
        )
      );
      return;
    }
    next();
  };
}

export function assertCinemaAccess(user: AuthenticatedUser | undefined, cinemaId: string): void {
  if (!user) {
    throw AppError.unauthorized();
  }
  if (user.roles.includes('PLATFORM_ADMIN')) {
    return;
  }
  if (!user.managedCinemaIds.includes(cinemaId)) {
    throw AppError.forbidden(
      `You are not authorized to manage or validate resources for cinema ${cinemaId}`
    );
  }
}

export const identityRouter = Router();

identityRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const result = await identityService.register(
      body,
      req.ip,
      req.headers['user-agent']
    );
    res.cookie('tixora_refresh', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.jwt.refreshExpiryDays * 86400 * 1000,
    });
    res.status(201).json({ success: true, data: result });
  })
);

identityRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await identityService.login(
      body,
      req.ip,
      req.headers['user-agent']
    );
    res.cookie('tixora_refresh', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.jwt.refreshExpiryDays * 86400 * 1000,
    });
    res.json({ success: true, data: result });
  })
);

identityRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const rawRefresh = req.body?.refreshToken || req.cookies?.tixora_refresh;
    const result = await identityService.refreshSession(
      rawRefresh,
      req.ip,
      req.headers['user-agent']
    );
    res.cookie('tixora_refresh', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.jwt.refreshExpiryDays * 86400 * 1000,
    });
    res.json({ success: true, data: result });
  })
);

identityRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const rawRefresh = req.body?.refreshToken || req.cookies?.tixora_refresh;
    await identityService.logout(rawRefresh);
    res.clearCookie('tixora_refresh');
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  })
);

