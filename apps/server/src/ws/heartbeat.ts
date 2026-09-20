import { WebSocket } from 'ws';
import { ClientConnection, registry } from './connection-registry.js';

export interface HeartbeatConfig {
  pingIntervalMs?: number;
  pongTimeoutMs?: number;
}

export class HeartbeatManager {
  private intervalTimer: NodeJS.Timeout | null = null;
  private readonly pingIntervalMs: number;
  private readonly onTimeoutCallback?: (conn: ClientConnection) => void;

  constructor(
    config: HeartbeatConfig = {},
    onTimeout?: (conn: ClientConnection) => void
  ) {
    this.pingIntervalMs = config.pingIntervalMs ?? 30000;
    this.onTimeoutCallback = onTimeout;
  }

  /**
   * Sets up socket listeners for heartbeat ping/pong lifecycle.
   */
  setupSocket(conn: ClientConnection): void {
    conn.isAlive = true;

    conn.ws.on('pong', () => {
      conn.isAlive = true;
    });
  }

  /**
   * Starts periodic ping sweeping of all registered connections.
   */
  start(): void {
    if (this.intervalTimer) return;

    this.intervalTimer = setInterval(() => {
      for (const conn of registry.getAllConnections()) {
        if (!conn.isAlive) {
          console.warn(`[Heartbeat] Connection ${conn.connectionId} (User ${conn.userId}) timed out; terminating`);
          try {
            conn.ws.terminate();
          } catch (err) {
            console.error(`[Heartbeat] Error terminating connection ${conn.connectionId}:`, err);
          }

          if (this.onTimeoutCallback) {
            this.onTimeoutCallback(conn);
          }
          continue;
        }

        conn.isAlive = false;
        try {
          conn.ws.ping();
        } catch (err) {
          console.error(`[Heartbeat] Error sending ping to ${conn.connectionId}:`, err);
        }
      }
    }, this.pingIntervalMs);

    // Prevent this interval from holding open the Node process during tests/shutdown
    if (this.intervalTimer.unref) {
      this.intervalTimer.unref();
    }
  }

  /**
   * Stops the heartbeat sweep timer.
   */
  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}
