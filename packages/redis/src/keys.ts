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

export function getRoomLobbyKey(roomId: string): string {
  return `${PREFIX}:room:${roomId}:lobby`;
}

export function getRoomCodeKey(roomCode: string): string {
  return `${PREFIX}:code:${roomCode.toUpperCase()}:room_id`;
}

export function getMatchmakingQueueKey(
  variant = 'POINTS_13',
  maxPlayers = 2
): string {
  return `${PREFIX}:matchmaking:queue:${variant}:${maxPlayers}`;
}

export function getUserQueueKey(userId: string): string {
  return `${PREFIX}:user:${userId}:queue`;
}
