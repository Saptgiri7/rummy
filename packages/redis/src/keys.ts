const PREFIX = 'rummy';

export function getRoomStateKey(roomId: string): string {
  return `${PREFIX}:room:${roomId}:state`;
}

export function getRoomLockKey(roomId: string): string {
  return `${PREFIX}:lock:room:${roomId}`;
}

export function getUserActiveRoomKey(userId: string): string {
  return `${PREFIX}:user:${userId}:active_room`;
}

export function getRoomEventChannel(roomId: string): string {
  return `${PREFIX}:events:room:${roomId}`;
}

export function getMatchmakingQueueKey(
  variant = 'POINTS_13',
  maxPlayers = 2,
  stake = 10
): string {
  return `${PREFIX}:matchmaking:queue:${variant}:${maxPlayers}:${stake}`;
}
