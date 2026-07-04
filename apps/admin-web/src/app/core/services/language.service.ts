import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { TranslateService } from '@ngx-translate/core';

export type AppLang = 'ar' | 'en';
const LANG_KEY = 'tftsp.admin.lang';
const RTL_LANGS: AppLang[] = ['ar'];

/**
 * Single source of truth for language + direction. Switching calls translate.use()
 * and flips <html dir/lang> synchronously — no reload (M1 acceptance criterion).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly primeng = inject(PrimeNG);
  private readonly document = inject(DOCUMENT);

  private readonly _lang = signal<AppLang>('ar');
  readonly lang = this._lang.asReadonly();
  readonly dir = computed<'rtl' | 'ltr'>(() => (RTL_LANGS.includes(this._lang()) ? 'rtl' : 'ltr'));
  readonly isRtl = computed(() => this.dir() === 'rtl');

  /** Called once at bootstrap (see app.config APP_INITIALIZER). */
  init(): void {
    this.translate.addLangs(['ar', 'en']);
    this.translate.setFallbackLang('en');
    const stored = localStorage.getItem(LANG_KEY) as AppLang | null;
    const initial: AppLang = stored ?? 'ar';
    this.use(initial);
  }

  toggle(): void {
    this.use(this._lang() === 'ar' ? 'en' : 'ar');
  }

  use(lang: AppLang): void {
    this._lang.set(lang);
    localStorage.setItem(LANG_KEY, lang);
    this.translate.use(lang);

    const dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
    const html = this.document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', dir);

    // Localise PrimeNG built-in labels for the active language.
    this.translate.get('primeng').subscribe((config) => {
      if (config && typeof config === 'object') {
        this.primeng.setTranslation(config as Record<string, unknown>);
      }
    });
  }
}
