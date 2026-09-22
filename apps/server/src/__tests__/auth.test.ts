import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { closeDb } from '@rummy/database';

describe('Authentication & User API Integration Tests', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  const timestamp = Date.now();
  const testUser = {
    username: `player_${timestamp}`,
    email: `player_${timestamp}@example.com`,
    password: 'Password123!'
  };

  let accessToken = '';
  let refreshToken = '';

  it('POST /api/auth/register creates user and provisions 10000 starting chips', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.username).toBe(testUser.username);
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user.chips).toBe(10000);

    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('POST /api/auth/register rejects duplicate email with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `diff_${Math.floor(Math.random() * 100000)}`,
        email: testUser.email,
        password: 'Password123!'
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('POST /api/auth/register rejects short password (< 8 chars) with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `valid_user_${timestamp}`,
        email: `valid_${timestamp}@example.com`,
        password: 'short'
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/auth/login succeeds with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('POST /api/auth/login rejects incorrect password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword999'
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me returns authenticated profile when Bearer token is provided', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe(testUser.username);
    expect(res.body.email).toBe(testUser.email);
    expect(res.body.chips).toBe(10000);
  });

  it('GET /api/auth/me rejects requests without token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/refresh rotates refresh token and provides new token pair', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken); // Token rotated!

    // Using the old refresh token must now be rejected (anti-replay)
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(replayRes.status).toBe(401);
  });

  it('PATCH /api/auth/profile/username updates display name and returns new accessToken', async () => {
    const updatedName = `Renamed_${Date.now().toString().slice(-4)}`;
    const res = await request(app)
      .patch('/api/auth/profile/username')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ username: updatedName });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.username).toBe(updatedName);
  });

  it('PATCH /api/auth/profile/username rejects invalid username length', async () => {
    const res = await request(app)
      .patch('/api/auth/profile/username')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ username: 'ab' });

    expect(res.status).toBe(400);
  });

  it('POST /api/auth/logout revokes token', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
