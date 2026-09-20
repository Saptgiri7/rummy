import { Router, Response } from 'express';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  ErrorCode
} from '@rummy/shared';
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  getUserProfile,
  saveRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken
} from '@rummy/database';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken
} from '../auth/jwt';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==========================================
// POST /api/auth/register
// ==========================================
router.post('/register', async (req, res: Response) => {
  const parseResult = RegisterRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid registration details',
      details: parseResult.error.flatten()
    });
  }

  const { username, email, password } = parseResult.data;

  try {
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        code: ErrorCode.CONFLICT,
        message: 'A user with this email address already exists'
      });
    }

    const existingUsername = await findUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        code: ErrorCode.CONFLICT,
        message: 'This username is already taken'
      });
    }

    const passwordHash = await hashPassword(password);
    const { user, wallet } = await createUser(username, email, passwordHash, 10000);

    const tokenPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(tokenPayload);
    const { token: refreshToken, expiresAt } = generateRefreshToken(tokenPayload);

    await saveRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        chips: wallet?.chips ?? 10000,
        gamesPlayed: 0,
        gamesWon: 0
      }
    });
  } catch (err) {
    console.error('[AUTH] Registration error:', err);
    return res.status(500).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred during registration'
    });
  }
});

// ==========================================
// POST /api/auth/login
// ==========================================
router.post('/login', async (req, res: Response) => {
  const parseResult = LoginRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid login details',
      details: parseResult.error.flatten()
    });
  }

  const { email, password } = parseResult.data;

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid email or password'
      });
    }

    const profile = await getUserProfile(user.id);
    const tokenPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(tokenPayload);
    const { token: refreshToken, expiresAt } = generateRefreshToken(tokenPayload);

    await saveRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        chips: profile?.chips ?? 10000,
        gamesPlayed: profile?.gamesPlayed ?? 0,
        gamesWon: profile?.gamesWon ?? 0
      }
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return res.status(500).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred during login'
    });
  }
});

// ==========================================
// POST /api/auth/refresh
// ==========================================
router.post('/refresh', async (req, res: Response) => {
  const parseResult = RefreshTokenRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Refresh token is required'
    });
  }

  const { refreshToken } = parseResult.data;

  try {
    const payload = verifyRefreshToken(refreshToken);
    const hashed = hashToken(refreshToken);

    const storedToken = await findValidRefreshToken(hashed);
    if (!storedToken) {
      return res.status(401).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid or revoked refresh token'
      });
    }

    // Token rotation: Revoke old token and issue new pair
    await revokeRefreshToken(hashed);

    const tokenPayload = { userId: payload.userId, username: payload.username };
    const newAccessToken = generateAccessToken(tokenPayload);
    const { token: newRefreshToken, expiresAt } = generateRefreshToken(tokenPayload);

    await saveRefreshToken(payload.userId, hashToken(newRefreshToken), expiresAt);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (_err) {
    return res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Invalid refresh token'
    });
  }
});

// ==========================================
// POST /api/auth/logout
// ==========================================
router.post('/logout', async (req, res: Response) => {
  const { refreshToken } = req.body;
  if (typeof refreshToken === 'string') {
    const hashed = hashToken(refreshToken);
    await revokeRefreshToken(hashed);
  }
  return res.json({ success: true });
});

// ==========================================
// GET /api/auth/me
// ==========================================
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: 'Unauthorized' });
  }

  try {
    const profile = await getUserProfile(req.user.userId);
    if (!profile) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: 'User profile not found' });
    }
    return res.json(profile);
  } catch (err) {
    console.error('[AUTH] Profile fetch error:', err);
    return res.status(500).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Failed to retrieve profile'
    });
  }
});

export default router;
