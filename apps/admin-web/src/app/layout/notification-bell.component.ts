import { Component, ViewChild, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { Popover, PopoverModule } from 'primeng/popover';
import { NotificationService } from '../core/services/notification.service';
import type { Notification } from '../core/models';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [DatePipe, TranslatePipe, ButtonModule, BadgeModule, PopoverModule],
  template: `
    <button
      type="button"
      class="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
      (click)="op.toggle($event)"
      [attr.aria-label]="'notifications.title' | translate"
    >
      <i class="pi pi-bell text-lg"></i>
      @if (notifications.hasUnread()) {
        <span
          class="absolute -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white end-0"
        >
          {{ notifications.unread() > 99 ? '99+' : notifications.unread() }}
        </span>
      }
    </button>

    <p-popover #op [style]="{ width: '22rem' }">
      <div class="flex items-center justify-between border-b border-gray-100 pb-2">
        <span class="font-medium text-gray-700">{{ 'notifications.title' | translate }}</span>
        @if (notifications.hasUnread()) {
          <button type="button" class="text-xs text-tribe hover:underline" (click)="markAllRead()">
            {{ 'notifications.markAllRead' | translate }}
          </button>
        }
      </div>

      <div class="mt-2 max-h-96 overflow-y-auto">
        @if (notifications.notifications().length === 0) {
          <p class="py-6 text-center text-sm text-gray-400">{{ 'notifications.empty' | translate }}</p>
        } @else {
          <ul class="flex flex-col">
            @for (n of notifications.notifications(); track n.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-start gap-3 rounded-md p-2 text-start hover:bg-gray-50"
                  [class.bg-tribe]="!n.readAt"
                  [class.bg-opacity-5]="!n.readAt"
                  (click)="open(n)"
                >
                  <i class="pi {{ icon(n.type) }} mt-1 text-tribe"></i>
                  <span class="flex-1">
                    <span class="block text-sm text-gray-700">{{
                      'notifications.messages.' + n.type | translate
                    }}</span>
                    <span class="block text-xs text-gray-400" [attr.dir]="'ltr'">{{
                      n.createdAt | date: 'short'
                    }}</span>
                  </span>
                  @if (!n.readAt) {
                    <span class="mt-1 h-2 w-2 rounded-full bg-red-500"></span>
                  }
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </p-popover>
  `,
})
export class NotificationBellComponent {
  readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  @ViewChild('op') private readonly op!: Popover;

  markAllRead(): void {
    this.notifications.markAllRead();
  }

  open(n: Notification): void {
    if (!n.readAt) this.notifications.markRead(n.id);
    const crId = n.payload?.['changeRequestId'];
    this.op.hide();
    if (typeof crId === 'string') {
      this.router.navigate(['/change-requests', crId]);
    }
  }

  icon(type: string): string {
    if (type.includes('approved') || type.includes('published')) return 'pi-check-circle';
    if (type.includes('rejected') || type.includes('conflict')) return 'pi-times-circle';
    if (type.includes('expir')) return 'pi-clock';
    if (type.includes('changes_requested')) return 'pi-pencil';
    return 'pi-info-circle';
  }
}
