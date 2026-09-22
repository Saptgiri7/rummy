import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { createUser } from '@rummy/database';
import { hashPassword, generateAccessToken } from '../auth/jwt.js';

describe('Admin Dashboard & RBAC Authorization Tests', () => {
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // 1. Create standard USER
    const userPass = await hashPassword('UserPass123!');
    const standardUser = await createUser(
      `std_user_${Date.now().toString().slice(-6)}`,
      `user_${Date.now()}@example.com`,
      userPass,
      10000,
      null,
      'USER',
      true
    );
    userToken = generateAccessToken({
      userId: standardUser.user.id,
      username: standardUser.user.username,
      role: 'USER'
    });

    // 2. Create ADMIN user
    const adminPass = await hashPassword('AdminPass123!');
    const adminUser = await createUser(
      `adm_user_${Date.now().toString().slice(-6)}`,
      `admin_${Date.now()}@example.com`,
      adminPass,
      100000,
      null,
      'ADMIN',
      true
    );
    adminToken = generateAccessToken({
      userId: adminUser.user.id,
      username: adminUser.user.username,
      role: 'ADMIN'
    });
  });

  it('GET /api/admin/metrics rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/metrics rejects normal USER role with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.message).toContain('Administrator role required');
  });

  it('GET /api/admin/metrics allows ADMIN role and returns metrics object', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.totalUsers).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.metrics.verifiedUsers).toBe('number');
    expect(typeof res.body.metrics.activeSockets).toBe('number');
    expect(typeof res.body.metrics.activeTables).toBe('number');
    expect(typeof res.body.metrics.totalChips).toBe('number');
  });

  it('GET /api/admin/users returns paginated user registry with roles', async () => {
    const res = await request(app)
      .get('/api/admin/users?limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThan(0);
    expect(res.body.users[0]).toHaveProperty('username');
    expect(res.body.users[0]).toHaveProperty('role');
    expect(res.body.users[0]).toHaveProperty('chips');
  });

  it('GET /api/admin/tables returns active tables list', async () => {
    const res = await request(app)
      .get('/api/admin/tables')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tables)).toBe(true);
  });
});
