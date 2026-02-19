import { io, Socket } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(token?: string, userId?: string) {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token };
    s.connect();
    s.on('connect', () => {
      if (userId) s.emit('authenticate', { userId });
    });
  }
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}

export default { getSocket, connectSocket, disconnectSocket };
