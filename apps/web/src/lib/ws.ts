"use client";
import { useEffect, useState, useRef, useCallback } from 'react';

export function useWebSocket() {
  const [messages, setMessages] = useState<any[]>([]);
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
    if (!token) return;

    try {
        ws.current = new WebSocket(`ws://localhost:3001/api/v1/ws?token=${token}`);
        
        ws.current.onmessage = (event) => {
          try {
             setMessages(prev => [JSON.parse(event.data), ...prev]); 
          } catch(e) {}
        };

        ws.current.onclose = () => {
           setTimeout(() => {
              if (ws.current?.readyState !== WebSocket.OPEN) {
                 connect();
              }
           }, 3000);
        };
    } catch (e) {
        console.error("WS Connect fail");
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.onclose = null; // Disable auto reconnect for cleanup
        ws.current.close();
      }
    };
  }, [connect]);

  return { messages };
}
