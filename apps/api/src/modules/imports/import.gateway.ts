import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IMPORT_WS_EVENT, IMPORT_WS_NAMESPACE } from './import.constants';

export interface ImportProgressEvent {
  importBatchId: string;
  status: string;
  progress: number;
  counts?: Record<string, number>;
}

/**
 * Socket.IO gateway for live import progress (Spec §12). Same JWT handshake +
 * tenant+user room model as the `/notifications` gateway (D-204).
 */
@WebSocketGateway({ namespace: IMPORT_WS_NAMESPACE, cors: { origin: true } })
export class ImportGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ImportGateway.name);

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
      void client.join(ImportGateway.room(payload.tenantId, payload.sub));
    } catch (err) {
      this.logger.debug(`Rejected import socket: ${String(err)}`);
      client.disconnect(true);
    }
  }

  emitProgress(tenantId: string, userId: string, event: ImportProgressEvent): void {
    this.server?.to(ImportGateway.room(tenantId, userId)).emit(IMPORT_WS_EVENT, event);
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
