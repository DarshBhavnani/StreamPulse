import { io } from 'socket.io-client';
import { API_BASE } from './api';

let socket;

export function connectSocket() {
  if (!socket) {
    socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
