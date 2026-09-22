import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const ACCESS_SECRET = process.env['JWT_ACCESS_SECRET'] || 'dev_jwt_access_secret_do_not_use_in_production_key_1';
const REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'dev_jwt_refresh_secret_do_not_use_in_production_key_2';
const ACCESS_EXPIRY = process.env['JWT_ACCESS_EXPIRY'] || '15m';
const REFRESH_EXPIRY = process.env['JWT_REFRESH_EXPIRY'] || '7d';

export interface TokenPayload {
  userId: string;
  username: string;
  role?: 'USER' | 'ADMIN';
}

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY as jwt.SignOptions['expiresIn'] });
}

export function generateRefreshToken(payload: TokenPayload): { token: string; expiresAt: Date } {
  const token = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
    jwtid: crypto.randomUUID()
  });
  // 7 days in milliseconds
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}
