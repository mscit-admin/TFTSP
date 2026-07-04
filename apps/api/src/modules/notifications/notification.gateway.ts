import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from '@prisma/client';
import { NOTIFICATION_WS_EVENT } from './notification.constants';

/**
 * Socket.IO gateway, namespace `/notifications` (Spec §3 M2 / contract).
 * Handshake auth: the client sends the ACCESS JWT via `auth.token` (preferred)
 * or `Authorization: Bearer`. On success the socket joins a per-user, per-tenant
 * room; the server emits `notification` (payload = Notification) to that room.
 */
@WebSocketGateway({ namespace: '/notifications', cors: { origin: true } })
export class NotificationGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  static room(tenantId: string, userId: string): string {
    return `t:${tenantId}:u:${userId}`;
  }

  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('missing token');
      }
      const payload = this.jwt.verify<{ sub: string; tenantId?: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (!payload.tenantId) {
        throw new Error('token has no active tenant');
      }
      const room = NotificationGateway.room(payload.tenantId, payload.sub);
      void client.join(room);
      client.data.room = room;
    } catch (err) {
      this.logger.debug(`Rejected notification socket: ${String(err)}`);
      client.disconnect(true);
    }
  }

  /** Emit a persisted notification to its owner's room (≤2s of the state change). */
  emitToUser(notification: Notification): void {
    const room = NotificationGateway.room(notification.tenantId, notification.userId);
    this.server?.to(room).emit(NOTIFICATION_WS_EVENT, notification);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (authToken) {
      return authToken;
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    const queryToken = client.handshake.query.token;
    return typeof queryToken === 'string' ? queryToken : undefined;
  }
}
