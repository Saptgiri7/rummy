import { describe, it, expect } from 'vitest';
import {
  ClientMessageSchema,
  ServerMessageSchema,
  RegisterRequestSchema,
  LoginRequestSchema,
  ErrorCode
} from '../index.js';

describe('ClientMessageSchema Validation', () => {
  it('parses valid PING message', () => {
    const raw = { type: 'PING', timestamp: 123456789 };
    const parsed = ClientMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('parses valid DRAW_CARD from CLOSED deck', () => {
    const raw = {
      type: 'DRAW_CARD',
      payload: {
        roomId: 'room_123',
        source: 'CLOSED'
      }
    };
    const parsed = ClientMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('parses valid DRAW_CARD from OPEN pile', () => {
    const raw = {
      type: 'DRAW_CARD',
      payload: {
        roomId: 'room_123',
        source: 'OPEN'
      }
    };
    const parsed = ClientMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('rejects DRAW_CARD with invalid source', () => {
    const raw = {
      type: 'DRAW_CARD',
      payload: {
        roomId: 'room_123',
        source: 'MIDDLE' // Invalid!
      }
    };
    const parsed = ClientMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('parses valid DECLARE_SHOW message', () => {
    const raw = {
      type: 'DECLARE_SHOW',
      payload: {
        roomId: 'room_123',
        finishCardId: 'H_K_1',
        melds: [
          [
            { id: 'H_A_1', suit: 'HEARTS', rank: 'A', isPrintedJoker: false },
            { id: 'H_2_1', suit: 'HEARTS', rank: '2', isPrintedJoker: false },
            { id: 'H_3_1', suit: 'HEARTS', rank: '3', isPrintedJoker: false }
          ],
          [
            { id: 'S_A_1', suit: 'SPADES', rank: 'A', isPrintedJoker: false },
            { id: 'C_A_1', suit: 'CLUBS', rank: 'A', isPrintedJoker: false },
            { id: 'D_A_1', suit: 'DIAMONDS', rank: 'A', isPrintedJoker: false }
          ]
        ]
      }
    };
    const parsed = ClientMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown message type', () => {
    const raw = {
      type: 'HACK_SERVER',
      payload: {}
    };
    const parsed = ClientMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});

describe('ServerMessageSchema Validation', () => {
  it('parses CONNECTED message', () => {
    const raw = {
      type: 'CONNECTED',
      payload: {
        connectionId: 'conn_abc',
        serverTime: Date.now()
      }
    };
    const parsed = ServerMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('parses ERROR message with enum ErrorCode', () => {
    const raw = {
      type: 'ERROR',
      payload: {
        code: ErrorCode.NOT_YOUR_TURN,
        message: 'It is not your turn to play'
      }
    };
    const parsed = ServerMessageSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });
});

describe('REST DTO Validation', () => {
  it('validates correct register request', () => {
    const valid = {
      username: 'pro_rummy_99',
      email: 'player@example.com',
      password: 'StrongPassword123'
    };
    const parsed = RegisterRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid usernames (special characters, too short)', () => {
    const tooShort = {
      username: 'ab',
      email: 'player@example.com',
      password: 'StrongPassword123'
    };
    expect(RegisterRequestSchema.safeParse(tooShort).success).toBe(false);

    const specialChars = {
      username: 'player@$!',
      email: 'player@example.com',
      password: 'StrongPassword123'
    };
    expect(RegisterRequestSchema.safeParse(specialChars).success).toBe(false);
  });

  it('rejects short passwords (< 8 characters)', () => {
    const shortPass = {
      username: 'valid_user',
      email: 'player@example.com',
      password: '123'
    };
    expect(RegisterRequestSchema.safeParse(shortPass).success).toBe(false);
  });

  it('validates login request format', () => {
    const valid = {
      email: 'player@example.com',
      password: 'mypassword'
    };
    expect(LoginRequestSchema.safeParse(valid).success).toBe(true);

    const invalidEmail = {
      email: 'not-an-email',
      password: 'mypassword'
    };
    expect(LoginRequestSchema.safeParse(invalidEmail).success).toBe(false);
  });
});
