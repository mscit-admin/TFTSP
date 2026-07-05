import { existsSync } from 'node:fs';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { PaperSize } from './tree-html';

/**
 * Puppeteer-core renderer. CI must NOT download Chromium (Spec §M4.2 CI note):
 * we use puppeteer-core and point `executablePath` at the pre-installed browser
 * (PUPPETEER_EXECUTABLE_PATH, or PLAYWRIGHT_BROWSERS_PATH/chromium, or common
 * system paths). If no browser is found the endpoint returns a clear error —
 * the HTML builder itself is unit-tested for RTL/paper structure.
 */
@Injectable()
export class PdfRenderer {
  private readonly logger = new Logger(PdfRenderer.name);

  static resolveExecutable(): string | undefined {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    const candidates = [
      `${base}/chromium`,
      `${base}/chromium/chrome-linux/chrome`,
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
    ];
    return candidates.find((c) => existsSync(c));
  }

  private async withPage<T>(
    html: string,
    fn: (page: import('puppeteer-core').Page) => Promise<T>,
  ): Promise<T> {
    const executablePath = PdfRenderer.resolveExecutable();
    if (!executablePath) {
      this.logger.error('No Chromium executable found for export rendering.');
      throw new AppException(ErrorKeys.EXPORT_FAILED, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    // Lazy import so the module loads even where puppeteer-core is unused.
    const puppeteer = (await import('puppeteer-core')).default;
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      return await fn(page);
    } finally {
      await browser.close();
    }
  }

  renderPdf(html: string, paper: PaperSize): Promise<Buffer> {
    return this.withPage(html, async (page) => {
      const pdf = await page.pdf({ format: paper, printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    });
  }

  renderPng(html: string, scale: 2 | 4): Promise<Buffer> {
    return this.withPage(html, async (page) => {
      await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: scale });
      const png = await page.screenshot({ type: 'png', fullPage: true });
      return Buffer.from(png);
    });
  }
}
