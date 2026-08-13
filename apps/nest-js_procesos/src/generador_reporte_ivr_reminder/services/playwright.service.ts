import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { ReportLoggerService } from './logger.service';

@Injectable()
/**
 * Servicio que administra el lifecycle de Playwright y las páginas usadas por estrategias.
 */
export class PlaywrightService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private currentPage: Page | null = null;

    /**
     * Constructor.
     * @param logger Servicio de logging para registrar actividad de Playwright.
     */
  constructor(private logger: ReportLoggerService) {
    this.initBrowser();
  }

  private async initBrowser() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
      });
    } catch (error) {
      this.logger.error(`Error iniciando Chromium: ${error.message}`);
      throw error;
    }
  }

  async getPage(): Promise<Page> {
    if (this.currentPage && !this.currentPage.isClosed()) {
      await this.closeCurrentPage();
    }

    if (!this.browser) {
      await this.initBrowser();
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 720 },
    });

    this.currentPage = await context.newPage();

    return this.currentPage;
  }

  async closeCurrentPage(): Promise<void> {
    if (this.currentPage && !this.currentPage.isClosed()) {
      try {
        const context = this.currentPage.context();
        await this.currentPage.close();
        await context.close();
        this.currentPage = null;
      } catch (error) {
        this.logger.warn(`Error cerrando página: ${error.message}`);
      }
    }
  }

  async closePage(page: Page): Promise<void> {
    if (page && !page.isClosed()) {
      try {
        const context = page.context();
        await page.close();
        await context.close();
      } catch (error) {
        this.logger.warn(`Error cerrando página: ${error.message}`);
      }
    }
  }

  async onModuleDestroy() {
    await this.closeCurrentPage();
    if (this.browser) {
      await this.browser.close();
    }
  }
}
