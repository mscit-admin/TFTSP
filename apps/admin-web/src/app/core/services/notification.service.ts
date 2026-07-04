import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import type { Notification, NotificationListResponse } from '../models';
import { NOTIFICATION_WS_EVENT } from '../models';
import { ApiService } from './api.service';
import { TokenStorageService } from './token-storage.service';
import { SOCKET_URL } from '../tokens';

/**
 * Notifications: REST list/mark-read + a Socket.IO client on namespace `/notifications`.
 * The JWT is sent in the handshake `auth`; the server joins a tenant+user room and emits
 * `notification` events. All socket wiring is confined here (rule 6) — components read the
 * `notifications`/`unread` signals and subscribe to `incoming$` for toasts.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(TokenStorageService);
  private readonly socketUrl = inject(SOCKET_URL);

  private readonly _notifications = signal<Notification[]>([]);
  private readonly _unread = signal(0);
  readonly notifications = this._notifications.asReadonly();
  readonly unread = this._unread.asReadonly();
  readonly hasUnread = computed(() => this._unread() > 0);

  /** Emits each live notification pushed over the socket (Shell shows a toast). */
  private readonly _incoming = new Subject<Notification>();
  readonly incoming$: Observable<Notification> = this._incoming.asObservable();

  private socket: Socket | null = null;

  /** Called by the authenticated shell: load the first page + open the socket. */
  init(): void {
    this.loadList();
    this.connect();
  }

  loadList(page = 1, pageSize = 20): void {
    this.api
      .get<NotificationListResponse>('/notifications', { page, pageSize })
      .subscribe({
        next: (res) => {
          this._notifications.set(res.data);
          this._unread.set(res.unread);
        },
        error: () => void 0,
      });
  }

  markRead(id: string): void {
    // Optimistic: flip locally, then persist.
    this.applyRead(id);
    this.api.post(`/notifications/${id}/read`).subscribe({ error: () => void 0 });
  }

  markAllRead(): void {
    this._notifications.update((list) =>
      list.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    this._unread.set(0);
    this.api.post('/notifications/read-all').subscribe({ error: () => void 0 });
  }

  private applyRead(id: string): void {
    let changed = false;
    this._notifications.update((list) =>
      list.map((n) => {
        if (n.id === id && !n.readAt) {
          changed = true;
          return { ...n, readAt: new Date().toISOString() };
        }
        return n;
      }),
    );
    if (changed) this._unread.update((u) => Math.max(0, u - 1));
  }

  private connect(): void {
    if (this.socket) return;
    const base = this.socketUrl || '';
    this.socket = io(`${base}/notifications`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Function form re-reads the (possibly rotated) token on every (re)connect.
      auth: (cb) => cb({ token: this.storage.accessToken ?? '' }),
      autoConnect: true,
    });

    this.socket.on(NOTIFICATION_WS_EVENT, (payload: Notification) => this.handleIncoming(payload));
  }

  private handleIncoming(n: Notification): void {
    // Dedupe (server may re-emit on reconnect) and prepend.
    this._notifications.update((list) =>
      list.some((x) => x.id === n.id) ? list : [n, ...list],
    );
    if (!n.readAt) this._unread.update((u) => u + 1);
    this._incoming.next(n);
  }

  /** Called on logout — close the socket and clear state. */
  reset(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this._notifications.set([]);
    this._unread.set(0);
  }
}
