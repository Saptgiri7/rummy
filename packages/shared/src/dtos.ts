import { z } from 'zod';

export const RegisterRequestSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const UserSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  chips: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative().default(0),
  gamesWon: z.number().int().nonnegative().default(0)
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSummarySchema
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const CreateRoomRequestSchema = z.object({
  stake: z.number().int().min(1).default(10),
  maxPlayers: z.union([z.literal(2), z.literal(6)]).default(2)
});
export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const RoomSummarySchema = z.object({
  id: z.string(),
  stake: z.number(),
  maxPlayers: z.number(),
  currentPlayers: z.number(),
  status: z.enum(['WAITING', 'PLAYING', 'FINISHED']),
  createdAt: z.string()
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;
