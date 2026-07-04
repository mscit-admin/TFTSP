import { Injectable, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

export type AppLang = 'ar' | 'en';

const LANG_KEY = 'pw.lang';

/**
 * Instant language + direction switching with NO page reload.
 * Sets the <html lang> and <html dir> attributes reactively so RTL/LTR
 * flips everywhere immediately (M1 acceptance criterion).
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly lang = signal<AppLang>(this.initialLang());
  readonly isRtl = signal<boolean>(this.initialLang() === 'ar');

  constructor() {
    // Register both languages and apply the initial one.
    this.translate.addLangs(['ar', 'en']);
    this.translate.setFallbackLang('en');
    this.apply(this.lang());

    // Keep <html> attributes + storage in sync whenever lang changes.
    effect(() => {
      const l = this.lang();
      this.isRtl.set(l === 'ar');
      const html = this.document.documentElement;
      html.setAttribute('lang', l);
      html.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
      try {
        localStorage.setItem(LANG_KEY, l);
      } catch {
        /* ignore private-mode storage failures */
      }
    });
  }

  use(lang: AppLang): void {
    this.apply(lang);
    this.lang.set(lang);
  }

  toggle(): void {
    this.use(this.lang() === 'ar' ? 'en' : 'ar');
  }

  private apply(lang: AppLang): void {
    this.translate.use(lang);
  }

  private initialLang(): AppLang {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_KEY);
    } catch {
      /* ignore */
    }
    if (stored === 'ar' || stored === 'en') return stored;
    return environment.defaultLang;
  }
}
