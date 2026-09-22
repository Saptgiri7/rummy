import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('OTP Verification & Registration API Tests', () => {
  const testEmail = `test_otp_${Date.now()}@example.com`;
  const testPhone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;

  it('POST /api/auth/send-otp sends OTP to email and returns devOtpCode in dev mode', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({
        identifier: testEmail,
        type: 'EMAIL'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/Verification code (sent|dispatched)/);
    expect(res.body.devOtpCode).toBeDefined();
    expect(res.body.devOtpCode).toHaveLength(6);
  });

  it('POST /api/auth/send-otp rate-limits rapid repeated requests to the same identifier', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({
        identifier: testEmail,
        type: 'EMAIL'
      });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.cooldownSeconds).toBeGreaterThan(0);
  });

  it('POST /api/auth/register-with-otp rejects incorrect OTP code', async () => {
    const res = await request(app)
      .post('/api/auth/register-with-otp')
      .send({
        username: `user_${Date.now()}`,
        identifier: testEmail,
        type: 'EMAIL',
        password: 'Password123!',
        otp: '000000'
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_OTP');
  });

  it('POST /api/auth/send-otp sends OTP to phone number', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({
        identifier: testPhone,
        type: 'PHONE'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devOtpCode).toBeDefined();

    const otpCode = res.body.devOtpCode;
    const username = `phone_user_${Date.now().toString().slice(-6)}`;

    // Verify and register with phone
    const regRes = await request(app)
      .post('/api/auth/register-with-otp')
      .send({
        username,
        identifier: testPhone,
        type: 'PHONE',
        password: 'SecurePass123!',
        otp: otpCode
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.accessToken).toBeDefined();
    expect(regRes.body.user.phone).toBe(testPhone);
    expect(regRes.body.user.isVerified).toBe(true);
    expect(regRes.body.user.role).toBe('USER');

    // Login using phone number
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: testPhone,
        password: 'SecurePass123!'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.username).toBe(username);
    expect(loginRes.body.user.phone).toBe(testPhone);
  });
});
