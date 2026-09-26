import { io, Socket } from 'socket.io-client';
import { WS_URL } from './config';

export function createSocket(): Socket {
  return io(WS_URL, { transports: ['websocket'] });
}
