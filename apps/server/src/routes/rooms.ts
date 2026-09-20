import { Router, Response } from 'express';
import { z, ErrorCode } from '@rummy/shared';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { roomService } from '../matchmaking/room-service.js';
import { getRoomLobby, getRoomIdByCode } from '@rummy/redis';

const router = Router();

const CreateRoomBodySchema = z.object({
  maxPlayers: z.union([z.literal(2), z.literal(6)]).default(2)
});

/**
 * POST /api/rooms/create
 * Creates a private room and generates a 6-character room code to share with friends.
 */
router.post(
  '/create',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = CreateRoomBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid request body',
          details: parsed.error.issues
        });
        return;
      }

      const host = {
        id: req.user!.userId,
        username: req.user!.username
      };

      const lobby = await roomService.createRoom(host, parsed.data.maxPlayers);

      res.status(201).json({
        success: true,
        lobby
      });
    } catch (err: unknown) {
      console.error('[Rooms API] Failed to create room:', err);
      res.status(500).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to create room'
      });
    }
  }
);

/**
 * GET /api/rooms/:codeOrId
 * Retrieves current room lobby status and joined players.
 */
router.get(
  '/:codeOrId',
  async (req, res) => {
    try {
      const { codeOrId } = req.params;
      if (!codeOrId) {
        res.status(400).json({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Room code or ID is required'
        });
        return;
      }

      let roomId = codeOrId;
      const resolved = await getRoomIdByCode(codeOrId);
      if (resolved) {
        roomId = resolved;
      }

      const lobby = await getRoomLobby(roomId);
      if (!lobby) {
        res.status(404).json({
          code: ErrorCode.ROOM_NOT_FOUND,
          message: 'Room not found or expired'
        });
        return;
      }

      res.json({
        success: true,
        lobby
      });
    } catch (err: unknown) {
      console.error('[Rooms API] Failed to fetch room:', err);
      res.status(500).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Failed to fetch room'
      });
    }
  }
);

export default router;
