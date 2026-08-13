import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Page } from 'playwright';
import { RETRY_CONFIG } from './constants/report.constants';
import {
  ReportGenerationOptions,
  ReportResult,
} from './interfaces/report.interface';
import { EmailService } from './services/email.service';
import { ReportLoggerService } from './services/logger.service';
import { PlaywrightService } from './services/playwright.service';
import { StorageService } from './services/storage.service';
import { AttStrategy } from './strategies/att.strategy';
import { BbvaVigStrategy } from './strategies/bbva-vig.strategy';
import { BbvaStrategy } from './strategies/bbva.strategy';
import { GMFStrategy } from './strategies/gmf.strategy';

@Injectable()
/**
 * Servicio que orquesta la generación de reportes IVR usando diversas estrategias.
 * Maneja reintentos, notificaciones por correo y coordinación de estrategias.
 */
export class GeneradorService {
  private strategies: Map<string, any>;

  /**
   * Constructor.
   * @param playwrightService Servicio para control de navegador Playwright.
   * @param storageService Servicio para mover archivos a red.
   * @param emailService Servicio de envío de correos.
   * @param logger Servicio de logging para reportes.
   * @param gmfStrategy Estrategia GMF.
   * @param bbvaStrategy Estrategia BBVA.
   * @param bbvaVigStrategy Estrategia BBVA_VIG.
   * @param attStrategy Estrategia ATT.
   */
  constructor(
    private playwrightService: PlaywrightService,
    private storageService: StorageService,
    private emailService: EmailService,
    private logger: ReportLoggerService,
    private gmfStrategy: GMFStrategy,
    private bbvaStrategy: BbvaStrategy,
    private bbvaVigStrategy: BbvaVigStrategy,
    private attStrategy: AttStrategy,
  ) {
    this.strategies = new Map<string, any>([
      ['GMF', this.gmfStrategy],
      ['BBVA', this.bbvaStrategy],
      ['BBVA_VIG', this.bbvaVigStrategy],
      ['ATT', this.attStrategy],
    ]);
  }

  @Cron('30 07 * * *')
  async ejecutarAutomatico(): Promise<ReportResult[]> {
    this.logger.info('🤖 Iniciando ejecución automática programada');
    return this.generarTodos();
  }

  async generarTodos(
    options?: ReportGenerationOptions,
  ): Promise<ReportResult[]> {
    const resultados: ReportResult[] = [];
    const startTime = Date.now();

    for (const [type, strategy] of this.strategies) {
      const resultado = await this.generarConReintento(type, strategy, options);
      resultados.push(resultado);

      await this.sleep(2000);
    }

    const duration = Date.now() - startTime;

    if (!options?.skipEmail) {
      await this.emailService.sendSummary(resultados);
    }

    return resultados;
  }

  async generarUno(
    tipo: string,
    options?: ReportGenerationOptions,
  ): Promise<ReportResult> {
    const strategy = this.strategies.get(tipo.toUpperCase());
    if (!strategy) {
      throw new Error(`Reporte ${tipo} no encontrado`);
    }

    return this.generarConReintento(tipo, strategy, options);
  }

  private async generarConReintento(
    tipo: string,
    strategy: any,
    options?: ReportGenerationOptions,
    intento = 1,
  ): Promise<ReportResult> {
    const startTime = Date.now();
    let page: Page | null = null;

    try {
      page = await this.playwrightService.getPage();
      const tempPath = await strategy.execute(page);

      const fs = require('fs/promises');
      try {
        const stats = await fs.stat(tempPath);
      } catch (err) {
        this.logger.error(`Archivo temporal NO existe: ${tempPath}`);
        this.logger.error(`Error: ${err.message}`);
        throw new Error(`Archivo temporal no encontrado: ${tempPath}`);
      }

      if (page) {
        await this.playwrightService.closePage(page);
      }

      const finalPath = await this.storageService.moveToNetwork(tempPath, tipo);

      if (!options?.skipEmail) {
        await this.emailService.sendReportEmail(tipo, finalPath);
      }

      const duration = Date.now() - startTime;

      return {
        type: tipo,
        success: true,
        filePath: finalPath,
        timestamp: new Date(),
        duration,
      };
    } catch (error) {
      if (page) {
        await this.playwrightService.closePage(page);
      }

      this.logger.error(` Error detallado en ${tipo}:`);
      this.logger.error(`   Mensaje: ${error.message}`);
      this.logger.error(`   Código: ${error.code || 'N/A'}`);
      this.logger.error(`   Stack: ${error.stack}`);

      if (error.message === 'NO_DATA_AVAILABLE') {
        this.logger.warn(
          ` No hay datos disponibles para ${tipo}, omitiendo...`,
        );
        return {
          type: tipo,
          success: false,
          error: 'No hay datos disponibles para generar el reporte',
          timestamp: new Date(),
          duration: Date.now() - startTime,
        };
      }

      this.logger.error(`Error en ${tipo}: ${error.message}`);

      if (intento < RETRY_CONFIG.MAX_ATTEMPTS) {
        const delay =
          RETRY_CONFIG.INITIAL_DELAY_MS *
          Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, intento - 1);
        this.logger.info(`Reintentando ${tipo} en ${delay}ms...`);
        await this.sleep(delay);
        return this.generarConReintento(tipo, strategy, options, intento + 1);
      }

      return {
        type: tipo,
        success: false,
        error: error.message,
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async obtenerEstado(): Promise<any> {
    return {
      status: 'operativo',
      ultimaEjecucion: await this.getLastExecutionTime(),
      reportesDisponibles: Array.from(this.strategies.keys()),
      programacion: 'Diario a las 6:00 AM',
    };
  }

  private async getLastExecutionTime(): Promise<string> {
    return new Date().toISOString();
  }
}
