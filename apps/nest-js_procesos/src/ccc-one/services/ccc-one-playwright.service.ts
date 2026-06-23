import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { ReportLoggerService } from '../../generador_reporte_ivr_reminder/services/logger.service';
import {
  CCC_ONE_CONFIG,
  CCCONE_CREDENTIALS,
  TIMEOUT_CONFIG_CCC,
} from '../constants/ccc-one.constants';

@Injectable()
export class CccOnePlaywrightService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(private logger: ReportLoggerService) {}

  async iniciar(): Promise<Page | null> {
    try {
      const fs = require('fs');
      if (!fs.existsSync(CCC_ONE_CONFIG.CHROME_PATH)) {
        this.logger.warn(
          ` Chrome no encontrado en: ${CCC_ONE_CONFIG.CHROME_PATH}. Usando chromium por defecto.`,
        );
      }

      this.browser = await chromium.launch({
        headless: false,
        executablePath: fs.existsSync(CCC_ONE_CONFIG.CHROME_PATH)
          ? CCC_ONE_CONFIG.CHROME_PATH
          : undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true,
        acceptDownloads: true,
      });

      this.page = await this.context.newPage();
      return this.page;
    } catch (error) {
      this.logger.error(` Error iniciando navegador: ${error.message}`);
      return null;
    }
  }

  async login(page: Page): Promise<boolean> {
    try {
      const usuario = CCCONE_CREDENTIALS.USER;
      const password = CCCONE_CREDENTIALS.PASSWORD;

      if (!usuario || !password) {
        this.logger.error(
          ' Faltan credenciales de CCC One en variables de entorno',
        );
        return false;
      }

      this.logger.info(` Intentando login en: ${CCC_ONE_CONFIG.URL}`);

      await page.goto(CCC_ONE_CONFIG.URL, {
        timeout: TIMEOUT_CONFIG_CCC.LOGIN_TIMEOUT_MS,
      });

      const usernameSelector = await page
        .waitForSelector('#username', {
          timeout: TIMEOUT_CONFIG_CCC.LOGIN_TIMEOUT_MS,
        })
        .catch(() => null);
      if (!usernameSelector) {
        this.logger.error(
          ' No se encontró el campo de usuario. La página no cargó correctamente.',
        );
        return false;
      }

      await page.fill('#username', usuario);
      await page.fill('#password', password);
      await page.click('#btnSave');

      await page.waitForTimeout(10000);

      const loginExitoso = await page
        .waitForSelector('span.select2-selection--single', { timeout: 15000 })
        .catch(() => null);
      if (!loginExitoso) {
        this.logger.error(
          ' Login fallido. No se encontró el selector de campaña.',
        );
        return false;
      }

      this.logger.info(' Login CCC One exitoso');
      await this.cerrarModalNotificaciones(page);
      return true;
    } catch (error) {
      this.logger.error(` Error en login: ${error.message}`);
      return false;
    }
  }

  private async cerrarModalNotificaciones(page: Page): Promise<void> {
    try {
      for (const frame of page.frames()) {
        try {
          const modal = frame.locator('div.modal-content', {
            hasText: 'Notificaciones de Escritorio',
          });
          if ((await modal.count()) > 0 && (await modal.first().isVisible())) {
            await frame
              .locator("button[data-dismiss='modal']")
              .first()
              .click({ force: true });
            this.logger.info('Modal de notificaciones cerrado');
            break;
          }
        } catch (error) {}
      }
    } catch (error) {
      this.logger.debug(
        `No se pudo cerrar modal (no es crítico): ${error.message}`,
      );
    }
  }

  async getPage(): Promise<Page | null> {
    if (!this.page || this.page.isClosed()) {
      return this.iniciar();
    }
    return this.page;
  }

  async cerrar(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      this.logger.info(' Navegador cerrado correctamente');
    } catch (error) {
      this.logger.warn(`Error cerrando navegador: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.cerrar();
  }
}
