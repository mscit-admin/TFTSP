import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../core/services/auth.service';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'pw-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ButtonModule],
  template: `
    <div class="pw-dark min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <!-- Top bar — deliberately distinct "mission control" look -->
      <header
        class="h-14 flex items-center gap-4 px-4 border-b border-slate-800 bg-[var(--pw-shell)]"
      >
        <div class="flex items-center gap-2 font-semibold tracking-wide">
          <span
            class="inline-flex items-center justify-center w-8 h-8 rounded-md bg-indigo-600 text-white"
          >
            <i class="pi pi-server"></i>
          </span>
          <span class="hidden sm:inline">{{ 'app.title' | translate }}</span>
          <span
            class="ms-2 text-[10px] uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
            >{{ 'app.badge' | translate }}</span
          >
        </div>

        <nav class="flex items-center gap-1 ms-4">
          <a
            routerLink="/dashboard"
            routerLinkActive="bg-slate-800 text-white"
            class="px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-800/70"
          >
            <i class="pi pi-chart-bar me-1"></i>{{ 'nav.dashboard' | translate }}
          </a>
          <a
            routerLink="/tenants"
            routerLinkActive="bg-slate-800 text-white"
            class="px-3 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-800/70"
          >
            <i class="pi pi-sitemap me-1"></i>{{ 'nav.tenants' | translate }}
          </a>
        </nav>

        <div class="ms-auto flex items-center gap-3">
          <button
            type="button"
            (click)="lang.toggle()"
            class="px-2.5 py-1 rounded-md text-sm border border-slate-700 hover:bg-slate-800"
          >
            <i class="pi pi-globe me-1"></i>{{ 'lang.switchTo' | translate }}
          </button>

          <span class="hidden md:inline text-sm text-slate-400">{{
            auth.user()?.email
          }}</span>

          <button
            type="button"
            (click)="logout()"
            class="px-2.5 py-1 rounded-md text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            <i class="pi pi-sign-out me-1"></i>{{ 'nav.logout' | translate }}
          </button>
        </div>
      </header>

      <!-- Routed content, rendered on a light canvas for readability -->
      <main class="flex-1 bg-slate-100 text-slate-900 pw-scroll overflow-auto">
        <div class="max-w-6xl mx-auto p-6">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
