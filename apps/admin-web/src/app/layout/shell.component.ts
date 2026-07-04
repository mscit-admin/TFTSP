import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../core/services/auth.service';
import { LanguageService } from '../core/services/language.service';

interface NavItem {
  route: string;
  labelKey: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ButtonModule],
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
            @for (item of nav; track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive="bg-tribe/10 text-tribe font-medium"
                class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                (click)="onNavClick()"
              >
                <i class="pi {{ item.icon }}"></i>
                <span>{{ item.labelKey | translate }}</span>
              </a>
            }
          </nav>
          @if (!canWrite()) {
            <p class="mt-4 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
              {{ 'nav.readOnlyNotice' | translate }}
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
  readonly lang = inject(LanguageService);

  readonly sidebarOpen = signal(false);
  readonly canWrite = this.auth.canWrite;

  readonly nav: NavItem[] = [
    { route: '/persons', labelKey: 'nav.persons', icon: 'pi-users' },
    { route: '/tribal-units', labelKey: 'nav.tribalUnits', icon: 'pi-sitemap' },
    { route: '/tree', labelKey: 'nav.tree', icon: 'pi-share-alt' },
    { route: '/settings', labelKey: 'nav.settings', icon: 'pi-cog' },
  ];

  readonly userName = computed(() => this.auth.user()?.fullName ?? '');
  readonly tenantName = computed(() => {
    const t = this.auth.activeTenant();
    if (!t) return '';
    return this.lang.isRtl() ? t.tenantNameAr : t.tenantNameEn;
  });

  onNavClick(): void {
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
