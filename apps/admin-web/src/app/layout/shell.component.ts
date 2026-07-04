import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { AuthService } from '../core/services/auth.service';
import { LanguageService } from '../core/services/language.service';
import { NotificationService } from '../core/services/notification.service';
import { ViewRequestService } from '../core/services/view-request.service';
import { NotificationBellComponent } from './notification-bell.component';

interface NavItem {
  route: string;
  labelKey: string;
  icon: string;
  /** optional count badge (e.g. pending view-requests) */
  badge?: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    ButtonModule,
    NotificationBellComponent,
  ],
  template: `
    <div class="flex min-h-screen flex-col">
      <!-- Topbar -->
      <header
        class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm"
      >
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="p-2 text-gray-600 lg:hidden"
            (click)="sidebarOpen.set(!sidebarOpen())"
            [attr.aria-label]="'nav.menu' | translate"
          >
            <i class="pi pi-bars"></i>
          </button>
          <span class="text-lg font-semibold text-tribe">{{ 'app.title' | translate }}</span>
          @if (tenantName()) {
            <span class="hidden text-sm text-gray-500 sm:inline">— {{ tenantName() }}</span>
          }
        </div>

        <div class="flex items-center gap-2">
          <app-notification-bell />
          <p-button
            [label]="lang.isRtl() ? 'EN' : 'ع'"
            severity="secondary"
            [text]="true"
            size="small"
            [ariaLabel]="'nav.switchLanguage' | translate"
            (onClick)="lang.toggle()"
          />
          <span class="hidden text-sm text-gray-600 md:inline">{{ userName() }}</span>
          <p-button
            icon="pi pi-sign-out"
            severity="secondary"
            [text]="true"
            size="small"
            [ariaLabel]="'nav.logout' | translate"
            (onClick)="logout()"
          />
        </div>
      </header>

      <div class="flex flex-1">
        <!-- Sidebar -->
        <aside
          class="w-60 shrink-0 border-e border-gray-200 bg-white p-3"
          [class.hidden]="!sidebarOpen()"
          [class.lg:block]="true"
        >
          <nav class="flex flex-col gap-1">
            @for (item of navItems(); track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive="bg-tribe/10 text-tribe font-medium"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                (click)="onNavClick()"
              >
                <i class="pi {{ item.icon }}"></i>
                <span class="flex-1">{{ item.labelKey | translate }}</span>
                @if (item.badge) {
                  <span
                    class="flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white"
                  >
                    {{ item.badge > 99 ? '99+' : item.badge }}
                  </span>
                }
              </a>
            }
          </nav>
          @if (!canWrite()) {
            <p class="mt-4 rounded-md bg-sky-50 p-2 text-xs text-sky-700">
              {{ 'nav.proposalNotice' | translate }}
            </p>
          }
        </aside>

        <!-- Content -->
        <main class="flex-1 overflow-x-auto p-4 lg:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly viewRequests = inject(ViewRequestService);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly lang = inject(LanguageService);

  readonly sidebarOpen = signal(false);
  readonly canWrite = this.auth.canWrite;

  private readonly baseNav: NavItem[] = [
    { route: '/persons', labelKey: 'nav.persons', icon: 'pi-users' },
    { route: '/tribal-units', labelKey: 'nav.tribalUnits', icon: 'pi-sitemap' },
    { route: '/tree', labelKey: 'nav.tree', icon: 'pi-share-alt' },
  ];

  /** Nav list is role-gated (review queue for reviewers/admins, settings for Tribe Admin). */
  readonly navItems = computed<NavItem[]>(() => {
    const items = [...this.baseNav];
    if (this.auth.canReview()) {
      items.push({ route: '/change-requests', labelKey: 'nav.reviewQueue', icon: 'pi-inbox' });
    }
    items.push({ route: '/my-requests', labelKey: 'nav.myRequests', icon: 'pi-file-edit' });
    // Bulk import is an admin write action (Tribe Admin / Deputy / Branch Admin).
    if (this.auth.canWrite()) {
      items.push({ route: '/imports', labelKey: 'nav.imports', icon: 'pi-upload' });
    }
    items.push({ route: '/settings', labelKey: 'nav.settings', icon: 'pi-cog' });
    if (this.auth.isTribeAdmin()) {
      items.push({ route: '/workflow-settings', labelKey: 'nav.workflow', icon: 'pi-sliders-h' });
      items.push({ route: '/visibility-settings', labelKey: 'nav.visibility', icon: 'pi-eye' });
      items.push({
        route: '/view-requests',
        labelKey: 'nav.viewRequests',
        icon: 'pi-id-card',
        badge: this.pendingViewRequests() || undefined,
      });
    }
    return items;
  });

  /** Pending tree-view requests (Tribe Admin badge). */
  readonly pendingViewRequests = signal(0);

  readonly userName = computed(() => this.auth.user()?.fullName ?? '');
  readonly tenantName = computed(() => {
    const t = this.auth.activeTenant();
    if (!t) return '';
    return this.lang.isRtl() ? t.tenantNameAr : t.tenantNameEn;
  });

  constructor() {
    // Authenticated container: load notifications + open the socket, toast live arrivals.
    this.notifications.init();
    this.notifications.incoming$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((n) => {
      this.messages.add({
        severity: 'info',
        summary: this.i18n.instant('notifications.title'),
        detail: this.i18n.instant('notifications.messages.' + n.type),
        life: 5000,
      });
    });

    // Pending tree-view requests badge (Tribe Admin only).
    if (this.auth.isTribeAdmin()) {
      this.viewRequests.list('pending').subscribe({
        next: (list) => this.pendingViewRequests.set(list.length),
        error: () => void 0,
      });
    }
  }

  onNavClick(): void {
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
  }

  logout(): void {
    this.notifications.reset();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
