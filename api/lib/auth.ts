import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const prisma = new PrismaClient();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: AuthUser): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract JWT token from request cookies or Authorization header
 */
export function extractToken(req: VercelRequest): string | null {
  // Try cookie first
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (authCookie) {
      return authCookie.split('=')[1];
    }
  }

  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Get current user from JWT token in request
 */
export async function getCurrentUser(req: VercelRequest): Promise<AuthUser | null> {
  const token = extractToken(req);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  // Fetch user from database to ensure they still exist and are active
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
    },
  });

  if (!user || !user.active) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthUser | null> {
  const user = await getCurrentUser(req);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized - Please log in' });
    return null;
  }

  return user;
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthUser | null> {
  const user = await requireAuth(req, res);

  if (!user) {
    return null; // Already sent 401 response
  }

  if (user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden - Admin access required' });
    return null;
  }

  return user;
}

/**
 * Set auth cookie in response
 */
export function setAuthCookie(res: VercelResponse, token: string): void {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds

  res.setHeader(
    'Set-Cookie',
    `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`
  );
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
  );
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}
