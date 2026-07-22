import { Server as IOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyAccessToken } from "./utils/jwt";

let io: IOServer | null = null;

function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function initRealtime(httpServer: HttpServer, corsOrigins: string[]): IOServer {
  io = new IOServer(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(userRoom(socket.data.userId as string));
  });

  return io;
}

// All emit helpers below are safe to call even when sockets aren't running
// (e.g. in the Jest/supertest environment, where createApp() never calls
// initRealtime) — they silently no-op instead of throwing.
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function emitToUsers(userIds: string[], event: string, payload: unknown) {
  if (userIds.length === 0) return;
  io?.to(userIds.map(userRoom)).emit(event, payload);
}
