import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = `ws://${location.host}/ws`;
const MAX_RECONNECT_DELAY = 30_000;

export function useWebSocket() {
  const wsRef   = useRef(null);
  const timerRef = useRef(null);
  const [status, setStatus]   = useState('connecting');
  const [messages, setMessages] = useState([]);

  const connect = useCallback(() => {
    let delay = 1000;
    const attempt = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { setStatus('connected'); delay = 1000; };
      ws.onclose = () => {
        setStatus('reconnecting');
        timerRef.current = setTimeout(() => { delay = Math.min(delay * 2, MAX_RECONNECT_DELAY); attempt(); }, delay);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          setMessages(prev => [msg, ...prev].slice(0, 200));
        } catch {}
      };
    };
    attempt();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(data));
  }, []);

  return { status, messages, send };
}
