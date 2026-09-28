import { io, Socket } from 'socket.io-client';
import { WS_URL } from './config';

export function createSocket(): Socket {
  const target = WS_URL && WS_URL.length > 0 ? WS_URL : window.location.origin;
  return io(target, { transports: ['websocket'] });
}
