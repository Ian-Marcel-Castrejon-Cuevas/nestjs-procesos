import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { BaseReportStrategy, StrategyConfig } from './base.strategy';
import { ReportLoggerService } from '../services/logger.service';
import { REPORT_TYPES, REPORT_CONFIGS } from '../constants/report.constants';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
/**
 * Estrategia de generación de reporte para ATT (implementación concreta).
 */
export class AttStrategy extends BaseReportStrategy {
  constructor(logger: ReportLoggerService) {
    const config: StrategyConfig = {
      type: REPORT_TYPES.ATT,
      searchText: REPORT_CONFIGS[REPORT_TYPES.ATT].searchText,
      filenamePrefix: REPORT_CONFIGS[REPORT_TYPES.ATT].filenamePrefix,
    };
    super(config, logger);
  }

  async execute(page: Page): Promise<string> {
    const startTime = Date.now();

    try {
      await this.login(page);

      await this.searchAndSelectCampaign(page);

      await this.navigateToReports(page);

      await this.configureDateAndTime(page);

      const filename = this.getFilename();

      const fileBuffer = await this.downloadReport(page, filename);

      const tempPath = await this.saveTempFile(filename, fileBuffer);

      await this.logout(page);

      const duration = Date.now() - startTime;

      return tempPath;
    } catch (error) {
      this.logger.error(
        `Error en reporte ${this.config.type}: ${error.message}`,
      );

      try {
        await this.logout(page);
      } catch (logoutError) {
        this.logger.warn(`Error al cerrar sesión: ${logoutError.message}`);
      }

      throw error;
    }
  }

  private async saveTempFile(
    filename: string,
    buffer: Buffer,
  ): Promise<string> {
    const tempDir = './temp_downloads';

    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      this.logger.warn(`Error creando directorio temporal: ${error.message}`);
    }

    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  protected async searchAndSelectCampaign(page: Page): Promise<void> {
    try {
      const searchInput = page.locator(
        '//input[@type="search" and contains(@class,"form-control")]',
      );
      await searchInput.waitFor({ state: 'visible', timeout: 15000 });
      await searchInput.click();
      await searchInput.fill(this.config.searchText);

      await page.waitForTimeout(2000);

      const card = page.locator(
        `//div[contains(@class,"cs-customer-card-center-panel") and .//p[text()="${this.config.searchText}"]]`,
      );

      await card.waitFor({ state: 'visible', timeout: 10000 });
      await card.scrollIntoViewIfNeeded();
      await card.click({ timeout: 5000 });
    } catch (error) {
      this.logger.error(
        `No se pudo encontrar o seleccionar la campaña ${this.config.searchText}`,
      );
      throw new Error(
        `Campaña no encontrada: ${this.config.searchText}. Error: ${error.message}`,
      );
    }
  }

  protected async checkDataAvailability(page: Page): Promise<boolean> {
    try {
      const buttonText = await page
        .locator('button.btn.btn-primary.btn.btn-secondary')
        .nth(1)
        .textContent({ timeout: 10000 });

      const hasData = buttonText ? !buttonText.includes('(0)') : false;

      return hasData;
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar disponibilidad de datos: ${error.message}`,
      );
      return false;
    }
  }

  protected async downloadReport(
    page: Page,
    filename: string,
  ): Promise<Buffer> {
    const hasData = await this.checkDataAvailability(page);

    if (!hasData) {
      throw new Error(
        `No hay datos disponibles para generar el reporte ${this.config.type}`,
      );
    }

    await page.getByRole('button', { name: 'Generar reporte' }).click();
    await page.waitForSelector('#btn-download', { timeout: 180000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 240000 });
    await page.click('#btn-download');
    const download = await downloadPromise;

    const actualFilename = download.suggestedFilename();

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const sizeKB = (buffer.length / 1024).toFixed(2);

    return buffer;
  }
}
