import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { BaseReportStrategy, StrategyConfig } from './base.strategy';
import { ReportLoggerService } from '../services/logger.service';
import { REPORT_TYPES, REPORT_CONFIGS } from '../constants/report.constants';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
/**
 * Estrategia BBVA_VIG para generación de reportes (con comportamiento específico).
 */
export class BbvaVigStrategy extends BaseReportStrategy {
  constructor(logger: ReportLoggerService) {
    const config: StrategyConfig = {
      type: REPORT_TYPES.BBVA_VIG,
      searchText: REPORT_CONFIGS[REPORT_TYPES.BBVA_VIG].searchText,
      filenamePrefix: REPORT_CONFIGS[REPORT_TYPES.BBVA_VIG].filenamePrefix,
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

  protected async downloadReport(
    page: Page,
    filename: string,
  ): Promise<Buffer> {
    try {
      const buttonText = await page
        .locator('button.btn.btn-primary.btn.btn-secondary')
        .nth(1)
        .textContent({ timeout: 30000 });

      if (buttonText && buttonText.includes('(0)')) {
        throw new Error(
          `No hay datos disponibles para generar el reporte ${this.config.type}`,
        );
      }

      await page.getByRole('button', { name: 'Generar reporte' }).click();
      await page.waitForSelector('#btn-download', { timeout: 180000 });

      const downloadPromise = page.waitForEvent('download', {
        timeout: 240000,
      });
      await page.click('#btn-download');
      const download = await downloadPromise;

      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      return buffer;
    } catch (error) {
      this.logger.error(
        `Error en descarga de ${this.config.type}: ${error.message}`,
      );
      throw error;
    }
  }
}
