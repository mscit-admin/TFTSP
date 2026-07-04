import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import type { ApiErrorBody } from '../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div class="mb-6 flex items-center justify-between">
          <h1 class="text-xl font-semibold text-tribe">{{ 'app.title' | translate }}</h1>
          <button
            type="button"
            class="text-sm text-gray-500 hover:text-tribe"
            (click)="lang.toggle()"
          >
            {{ lang.isRtl() ? 'EN' : 'ع' }}
          </button>
        </div>
        <p class="mb-6 text-sm text-gray-500">{{ 'auth.loginSubtitle' | translate }}</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'auth.email' | translate }}</span>
            <input
              pInputText
              type="email"
              formControlName="email"
              autocomplete="username"
              [attr.dir]="'ltr'"
              class="w-full"
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-sm text-gray-700">{{ 'auth.password' | translate }}</span>
            <p-password
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              autocomplete="current-password"
            />
          </label>

          @if (errorKey()) {
            <p-message severity="error" [text]="errorKey()! | translate" />
          }

          <p-button
            type="submit"
            [label]="'auth.login' | translate"
            [loading]="loading()"
            [disabled]="form.invalid || loading()"
            styleClass="w-full"
          />
        </form>
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
  readonly errorKey = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorKey.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/persons']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err.error as ApiErrorBody | undefined;
        this.errorKey.set(body?.messageKey ?? 'errors.auth.loginFailed');
      },
    });
  }
}
