import { io, Socket } from 'socket.io-client';
import { WS_URL } from './config';
import { getToken } from './storage';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket) return socket;

  const token = await getToken();
  socket = io(WS_URL, {
    query: { token: token || '' },
    transports: ['websocket'],
    autoConnect: false,
  });

  return socket;
}

export async function connectSocket() {
  const s = await getSocket();
  if (!s.connected) {
    const token = await getToken();
    // Update the token dynamically on reconnection
    s.io.opts.query = { token: token || '' };
    s.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
export default socket;
