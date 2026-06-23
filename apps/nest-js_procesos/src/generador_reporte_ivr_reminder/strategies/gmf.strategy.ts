import { Injectable } from '@nestjs/common';
import { Page } from 'playwright';
import { BaseReportStrategy, StrategyConfig } from './base.strategy';
import { ReportLoggerService } from '../services/logger.service';
import { REPORT_TYPES, REPORT_CONFIGS } from '../constants/report.constants';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class GMFStrategy extends BaseReportStrategy {
  constructor(logger: ReportLoggerService) {
    const config: StrategyConfig = {
      type: REPORT_TYPES.GMF,
      searchText: REPORT_CONFIGS[REPORT_TYPES.GMF].searchText,
      filenamePrefix: REPORT_CONFIGS[REPORT_TYPES.GMF].filenamePrefix,
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
      } catch (logoutError) {}
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
}
