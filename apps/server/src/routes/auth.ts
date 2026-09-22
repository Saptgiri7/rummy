import { Router, Response } from 'express';
import {
  RegisterRequestSchema,
  SendOtpRequestSchema,
  RegisterWithOtpRequestSchema,
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  ErrorCode
} from '@rummy/shared';
import {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserByUsername,
  findUserByIdentifier,
  getUserProfile,
  saveRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  updateUsername
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
import { otpService } from '../services/otp-service';
import { analyticsService } from '../services/analytics-service';

const router = Router();

// ==========================================
// POST /api/auth/send-otp
// ==========================================
router.post('/send-otp', async (req, res: Response) => {
  const parseResult = SendOtpRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid OTP request details',
      details: parseResult.error.flatten()
    });
  }

  const { identifier, type } = parseResult.data;

  try {
    // Check if user already registered with this identifier
    if (type === 'EMAIL') {
      const existing = await findUserByEmail(identifier.trim().toLowerCase());
      if (existing) {
        return res.status(409).json({
          code: ErrorCode.CONFLICT,
          message: 'An account with this email address already exists'
        });
      }
    } else if (type === 'PHONE') {
      const existing = await findUserByPhone(identifier.trim());
      if (existing) {
        return res.status(409).json({
          code: ErrorCode.CONFLICT,
          message: 'An account with this phone number already exists'
        });
      }
    }

    const otpResult = await otpService.sendOtp(identifier, type);
    if (!otpResult.success) {
      return res.status(429).json({
        code: ErrorCode.RATE_LIMITED,
        message: otpResult.message,
        cooldownSeconds: otpResult.cooldownSeconds
      });
    }

    return res.json({
      success: true,
      message: otpResult.message,
      devOtpCode: otpResult.devOtpCode,
      previewUrl: otpResult.previewUrl
    });
  } catch (err) {
    console.error('[AUTH] Send OTP error:', err);
    return res.status(500).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Failed to send verification code'
    });
  }
});

// ==========================================
// POST /api/auth/register-with-otp
// ==========================================
router.post('/register-with-otp', async (req, res: Response) => {
  const parseResult = RegisterWithOtpRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid registration parameters',
      details: parseResult.error.flatten()
    });
  }

  const { username, identifier, type, password, otp } = parseResult.data;
  const cleanUsername = username.trim();
  const cleanIdentifier = identifier.trim();

  try {
    // 1. Verify OTP code
    const verifyResult = await otpService.verifyOtp(cleanIdentifier, otp);
    if (!verifyResult.success) {
      return res.status(400).json({
        code: verifyResult.code || ErrorCode.INVALID_OTP,
        message: verifyResult.message || 'Invalid or expired verification code'
      });
    }

    // 2. Validate uniqueness
    const existingUser = await findUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(409).json({
        code: ErrorCode.CONFLICT,
        message: 'This username is already taken'
      });
    }

    let email = `${cleanUsername.toLowerCase()}@rummy.local`;
    let phone: string | null = null;

    if (type === 'EMAIL') {
      email = cleanIdentifier.toLowerCase();
      const existingEmail = await findUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          code: ErrorCode.CONFLICT,
          message: 'An account with this email address already exists'
        });
      }
    } else {
      phone = cleanIdentifier;
      const existingPhone = await findUserByPhone(phone);
      if (existingPhone) {
        return res.status(409).json({
          code: ErrorCode.CONFLICT,
          message: 'An account with this phone number already exists'
        });
      }
    }

    // 3. Create user record
    const passwordHash = await hashPassword(password);
    const { user, wallet } = await createUser(
      cleanUsername,
      email,
      passwordHash,
      10000,
      phone,
      'USER',
      true
    );

    analyticsService.trackEvent('USER_REGISTERED', user.id, {
      type,
      identifier: type === 'EMAIL' ? email : phone
    }, req.ip);

    // 4. Issue session tokens
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: 'USER' as const
    };
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
        phone: user.phone ?? null,
        role: user.role,
        isVerified: user.isVerified,
        chips: wallet?.chips ?? 10000,
        gamesPlayed: 0,
        gamesWon: 0
      }
    });
  } catch (err) {
    console.error('[AUTH] Register with OTP error:', err);
    return res.status(500).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred during account creation'
    });
  }
});

// ==========================================
// POST /api/auth/register (Standard/Legacy for Guests & Tests)
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
    const { user, wallet } = await createUser(username, email, passwordHash, 10000, null, 'USER', false);

    analyticsService.trackEvent('USER_REGISTERED', user.id, { type: 'DIRECT' }, req.ip);

    const tokenPayload = { userId: user.id, username: user.username, role: 'USER' as const };
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
        phone: user.phone ?? null,
        role: user.role,
        isVerified: user.isVerified,
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
// Supports Username, Email, OR Phone Number
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

  const { identifier, password } = parseResult.data;

  try {
    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return res.status(401).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid credentials. Please check your username, email, or phone number.'
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid credentials. Please check your password.'
      });
    }

    const profile = await getUserProfile(user.id);
    const userRole = (user.role ?? 'USER') as 'USER' | 'ADMIN';
    const tokenPayload = { userId: user.id, username: user.username, role: userRole };
    const accessToken = generateAccessToken(tokenPayload);
    const { token: refreshToken, expiresAt } = generateRefreshToken(tokenPayload);

    await saveRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    analyticsService.trackEvent('USER_LOGIN', user.id, { identifier }, req.ip);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone ?? null,
        role: userRole,
        isVerified: user.isVerified,
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

    // Token rotation
    await revokeRefreshToken(hashed);

    const tokenPayload = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role ?? 'USER'
    };
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

// ==========================================
// PATCH /api/auth/profile/username
// Allows authenticated users and guests to customize their display name
// ==========================================
router.patch('/profile/username', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ code: ErrorCode.UNAUTHORIZED, message: 'Unauthorized' });
  }

  const { username } = req.body;
  if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 20) {
    return res.status(400).json({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Username must be between 3 and 20 characters'
    });
  }

  const cleanUsername = username.trim();

  try {
    const existing = await findUserByUsername(cleanUsername);
    if (existing && existing.id !== req.user.userId) {
      return res.status(409).json({
        code: ErrorCode.CONFLICT,
        message: 'This display name is already taken. Please choose another.'
      });
    }

    const updatedUser = await updateUsername(req.user.userId, cleanUsername);
    if (!updatedUser) {
      return res.status(404).json({ code: ErrorCode.NOT_FOUND, message: 'User not found' });
    }

    // Issue updated token reflecting new username
    const tokenPayload = {
      userId: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role as 'USER' | 'ADMIN'
    };
    const accessToken = generateAccessToken(tokenPayload);

    const profile = await getUserProfile(updatedUser.id);

    return res.json({
      success: true,
      accessToken,
      user: profile
    });
  } catch (err) {
    console.error('[AUTH] Username update error:', err);
    return res.status(500).json({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Failed to update username'
    });
  }
});

export default router;
