import { useEffect, useRef, useState, useCallback } from 'react';
import { ClientMessage, ServerMessage } from '@rummy/shared';

export interface UseWebSocketOptions {
  token: string | null;
  onMessage?: (message: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({ token, onMessage, onConnect, onDisconnect }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManuallyClosedRef = useRef<boolean>(false);
  const messageQueueRef = useRef<ClientMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;

  const connect = useCallback(() => {
    if (!token) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isManuallyClosedRef.current = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect directly to backend port 4000 in local dev to avoid Vite proxy EPIPE drops
    const wsHost = (window.location.port === '3000' || window.location.port === '5173')
      ? `${window.location.hostname}:4000`
      : window.location.host;

    const wsUrl = `${protocol}//${wsHost}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      onConnectRef.current?.();

      // Flush any queued messages that were sent while connecting
      while (messageQueueRef.current.length > 0) {
        const queued = messageQueueRef.current.shift();
        if (queued && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(queued));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerMessage;
        onMessageRef.current?.(data);
      } catch (err) {
        console.error('[Client WS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnectRef.current?.();

      // Attempt auto-reconnect if not closed manually
      if (!isManuallyClosedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 1500);
      }
    };

    ws.onerror = (err) => {
      console.error('[Client WS] WebSocket error:', err);
    };
  }, [token]);

  useEffect(() => {
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: ClientMessage): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    // Queue message so it is delivered as soon as socket opens
    messageQueueRef.current.push(message);
    return true;
  }, []);

  return {
    isConnected,
    sendMessage,
    reconnect: connect
  };
}
