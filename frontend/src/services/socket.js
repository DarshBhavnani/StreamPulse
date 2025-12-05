import { io as ioClient } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
let socket;

export function connectSocket() {
  if (!socket) {
    socket = ioClient(SOCKET_URL, { transports: ['websocket'], autoConnect: true });
    socket.on('connect', () => console.log('[socket] connected', socket.id));
    socket.on('disconnect', (r) => console.log('[socket] disconnect', r));
    socket.on('connect_error', (err) => console.error('[socket] connect_error', err));
  }
  return socket;
}
