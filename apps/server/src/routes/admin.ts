import { Router, Response } from 'express';
import {
  getAdminPlatformMetrics,
  listUsersForAdmin,
  getRecentAnalyticsEvents
} from '@rummy/database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { registry } from '../ws/connection-registry.js';
import { coordinator } from '../ws/room-coordinator.js';

const router = Router();

// Secure all admin endpoints with JWT authentication and Administrator role requirement
router.use(authenticateToken);
router.use(requireAdmin);

// ==========================================
// GET /api/admin/metrics
// ==========================================
router.get('/metrics', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const dbMetrics = await getAdminPlatformMetrics();
    const activeSockets = registry.getActiveConnectionCount();
    const activeOnlineUsers = registry.getActiveUserCount();
    const activeTables = coordinator.getActiveRoomCount();

    const recentEvents = await getRecentAnalyticsEvents(10);

    return res.json({
      metrics: {
        totalUsers: dbMetrics.totalUsers,
        verifiedUsers: dbMetrics.verifiedUsers,
        phoneUsers: dbMetrics.phoneUsers,
        emailUsers: dbMetrics.emailUsers,
        activeSockets,
        activeOnlineUsers,
        activeTables,
        totalMatches: dbMetrics.totalMatches,
        totalChips: dbMetrics.totalChips
      },
      recentEvents
    });
  } catch (err) {
    console.error('[ADMIN] Metrics fetch error:', err);
    return res.status(500).json({ message: 'Failed to retrieve admin platform metrics' });
  }
});

// ==========================================
// GET /api/admin/users
// ==========================================
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query['limit'] as string) || '50', 10), 100);
    const offset = Math.max(parseInt((req.query['offset'] as string) || '0', 10), 0);

    const users = await listUsersForAdmin(limit, offset);
    return res.json({ users, limit, offset });
  } catch (err) {
    console.error('[ADMIN] Users fetch error:', err);
    return res.status(500).json({ message: 'Failed to list users' });
  }
});

// ==========================================
// GET /api/admin/tables
// ==========================================
router.get('/tables', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const activeRoomIds = coordinator.getActiveRoomIds();
    const tables = activeRoomIds.map((roomId) => {
      const connIds = registry.getRoomConnectionIds(roomId);
      return {
        roomId,
        playerCount: connIds.length,
        status: 'ACTIVE_MATCH'
      };
    });

    return res.json({ tables });
  } catch (err) {
    console.error('[ADMIN] Tables fetch error:', err);
    return res.status(500).json({ message: 'Failed to list active tables' });
  }
});

export default router;
