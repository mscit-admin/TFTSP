import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'pw-login',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonModule],
  template: `
    <div
      class="pw-dark min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4"
    >
      <div class="w-full max-w-sm">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2 font-semibold tracking-wide">
            <span
              class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-indigo-600"
            >
              <i class="pi pi-server text-white"></i>
            </span>
            {{ 'app.title' | translate }}
          </div>
          <button
            type="button"
            (click)="lang.toggle()"
            class="px-2.5 py-1 rounded-md text-sm border border-slate-700 hover:bg-slate-800"
          >
            <i class="pi pi-globe me-1"></i>{{ 'lang.switchTo' | translate }}
          </button>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h1 class="text-lg font-semibold mb-1">{{ 'login.heading' | translate }}</h1>
          <p class="text-sm text-slate-400 mb-5">{{ 'login.subheading' | translate }}</p>

          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
            <label class="block">
              <span class="text-sm text-slate-300">{{ 'login.email' | translate }}</span>
              <input
                type="email"
                formControlName="email"
                autocomplete="username"
                class="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <label class="block">
              <span class="text-sm text-slate-300">{{
                'login.password' | translate
              }}</span>
              <input
                type="password"
                formControlName="password"
                autocomplete="current-password"
                class="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            @if (error()) {
              <div
                class="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2"
              >
                {{ error()! | translate }}
              </div>
            }

            <button
              pButton
              type="submit"
              [disabled]="form.invalid || loading()"
              [label]="(loading() ? 'login.signingIn' : 'login.submit') | translate"
              class="w-full"
            ></button>
          </form>
        </div>

        <p class="text-center text-xs text-slate-500 mt-4">
          {{ 'login.securityNote' | translate }}
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(1)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res.user.isSuperAdmin) {
          // Not a platform operator — deny at the boundary and drop the session.
          this.auth.clearSession();
          this.error.set('login.errors.notSuperAdmin');
          return;
        }
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.mapError(err));
      },
    });
  }

  private mapError(err: HttpErrorResponse): string {
    const key = (err.error as { messageKey?: string } | null)?.messageKey;
    if (key === 'errors.account_locked') return 'login.errors.locked';
    if (err.status === 401) return 'login.errors.invalid';
    if (err.status === 0) return 'login.errors.network';
    return 'login.errors.generic';
  }
}
