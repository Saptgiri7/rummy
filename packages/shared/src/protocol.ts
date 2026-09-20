import { z } from 'zod';
import { CardDtoSchema } from './card.js';
import { ErrorCode } from './errors.js';

// ==========================================
// CLIENT -> SERVER INBOUND MESSAGE SCHEMAS
// ==========================================

export const PingMessageSchema = z.object({
  type: z.literal('PING'),
  timestamp: z.number().optional()
});

export const JoinMatchmakingMessageSchema = z.object({
  type: z.literal('JOIN_MATCHMAKING'),
  payload: z.object({
    gameVariant: z.enum(['POINTS_13']).default('POINTS_13'),
    maxPlayers: z.union([z.literal(2), z.literal(6)]).default(2),
    stake: z.number().int().min(0).default(10)
  })
});

export const LeaveMatchmakingMessageSchema = z.object({
  type: z.literal('LEAVE_MATCHMAKING')
});

export const JoinRoomMessageSchema = z.object({
  type: z.literal('JOIN_ROOM'),
  payload: z.object({
    roomId: z.string().min(1)
  })
});

export const DrawCardMessageSchema = z.object({
  type: z.literal('DRAW_CARD'),
  payload: z.object({
    roomId: z.string().min(1),
    source: z.enum(['CLOSED', 'OPEN'])
  })
});

export const DiscardCardMessageSchema = z.object({
  type: z.literal('DISCARD_CARD'),
  payload: z.object({
    roomId: z.string().min(1),
    cardId: z.string().min(1)
  })
});

export const DeclareShowMessageSchema = z.object({
  type: z.literal('DECLARE_SHOW'),
  payload: z.object({
    roomId: z.string().min(1),
    finishCardId: z.string().min(1),
    melds: z.array(z.array(CardDtoSchema)).min(2).max(6)
  })
});

export const DropHandMessageSchema = z.object({
  type: z.literal('DROP_HAND'),
  payload: z.object({
    roomId: z.string().min(1)
  })
});

export const SubmitFinalMeldsMessageSchema = z.object({
  type: z.literal('SUBMIT_FINAL_MELDS'),
  payload: z.object({
    roomId: z.string().min(1),
    melds: z.array(z.array(CardDtoSchema)).min(1).max(6)
  })
});

export const ClientMessageSchema = z.discriminatedUnion('type', [
  PingMessageSchema,
  JoinMatchmakingMessageSchema,
  LeaveMatchmakingMessageSchema,
  JoinRoomMessageSchema,
  DrawCardMessageSchema,
  DiscardCardMessageSchema,
  DeclareShowMessageSchema,
  DropHandMessageSchema,
  SubmitFinalMeldsMessageSchema
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ==========================================
// SERVER -> CLIENT OUTBOUND MESSAGE SCHEMAS
// ==========================================

export const ConnectedMessageSchema = z.object({
  type: z.literal('CONNECTED'),
  payload: z.object({
    connectionId: z.string(),
    userId: z.string().optional(),
    serverTime: z.number(),
    message: z.string().optional()
  })
});

export const PongMessageSchema = z.object({
  type: z.literal('PONG'),
  timestamp: z.number()
});

export const MatchmakingStatusMessageSchema = z.object({
  type: z.literal('MATCHMAKING_STATUS'),
  payload: z.object({
    status: z.enum(['QUEUED', 'MATCHED', 'CANCELLED']),
    queueTimeSec: z.number()
  })
});

export const RoomJoinedMessageSchema = z.object({
  type: z.literal('ROOM_JOINED'),
  payload: z.object({
    roomId: z.string(),
    players: z.array(z.string()),
    maxPlayers: z.number()
  })
});

export const GameStartedMessageSchema = z.object({
  type: z.literal('GAME_STARTED'),
  payload: z.object({
    roomId: z.string(),
    players: z.array(z.string()),
    activePlayerId: z.string(),
    wildJoker: CardDtoSchema,
    openCard: CardDtoSchema,
    initialHand: z.array(CardDtoSchema),
    turnTimeoutMs: z.number()
  })
});

export const CardDrawnPublicMessageSchema = z.object({
  type: z.literal('CARD_DRAWN_PUBLIC'),
  payload: z.object({
    roomId: z.string(),
    playerId: z.string(),
    source: z.enum(['CLOSED', 'OPEN']),
    cardCount: z.number()
  })
});

export const CardDrawnPrivateMessageSchema = z.object({
  type: z.literal('CARD_DRAWN_PRIVATE'),
  payload: z.object({
    roomId: z.string(),
    drawnCard: CardDtoSchema,
    hand: z.array(CardDtoSchema)
  })
});

export const CardDiscardedMessageSchema = z.object({
  type: z.literal('CARD_DISCARDED'),
  payload: z.object({
    roomId: z.string(),
    playerId: z.string(),
    discardedCard: CardDtoSchema,
    nextActivePlayerId: z.string(),
    turnTimeoutMs: z.number()
  })
});

export const PlayerDroppedMessageSchema = z.object({
  type: z.literal('PLAYER_DROPPED'),
  payload: z.object({
    roomId: z.string(),
    playerId: z.string(),
    penalty: z.number(),
    nextActivePlayerId: z.string()
  })
});

export const DeclarationSubmittedMessageSchema = z.object({
  type: z.literal('DECLARATION_SUBMITTED'),
  payload: z.object({
    roomId: z.string(),
    declaringPlayerId: z.string()
  })
});

export const RoundCompletedMessageSchema = z.object({
  type: z.literal('ROUND_COMPLETED'),
  payload: z.object({
    roomId: z.string(),
    winnerId: z.string(),
    scores: z.array(
      z.object({
        playerId: z.string(),
        points: z.number(),
        penalty: z.number(),
        melds: z.array(z.array(CardDtoSchema)).optional()
      })
    )
  })
});

export const PlayerDisconnectedMessageSchema = z.object({
  type: z.literal('PLAYER_DISCONNECTED'),
  payload: z.object({
    roomId: z.string(),
    playerId: z.string(),
    gracePeriodMs: z.number()
  })
});

export const PlayerReconnectedMessageSchema = z.object({
  type: z.literal('PLAYER_RECONNECTED'),
  payload: z.object({
    roomId: z.string(),
    playerId: z.string()
  })
});

export const GameReconnectedMessageSchema = z.object({
  type: z.literal('GAME_RECONNECTED'),
  payload: z.object({
    roomId: z.string(),
    activePlayerId: z.string(),
    wildJoker: CardDtoSchema,
    openPileTop: CardDtoSchema,
    hand: z.array(CardDtoSchema),
    players: z.array(z.string()),
    remainingTurnTimeMs: z.number()
  })
});

export const ErrorMessageSchema = z.object({
  type: z.literal('ERROR'),
  payload: z.object({
    code: z.nativeEnum(ErrorCode),
    message: z.string(),
    details: z.unknown().optional()
  })
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ConnectedMessageSchema,
  PongMessageSchema,
  MatchmakingStatusMessageSchema,
  RoomJoinedMessageSchema,
  GameStartedMessageSchema,
  CardDrawnPublicMessageSchema,
  CardDrawnPrivateMessageSchema,
  CardDiscardedMessageSchema,
  PlayerDroppedMessageSchema,
  DeclarationSubmittedMessageSchema,
  RoundCompletedMessageSchema,
  PlayerDisconnectedMessageSchema,
  PlayerReconnectedMessageSchema,
  GameReconnectedMessageSchema,
  ErrorMessageSchema
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
