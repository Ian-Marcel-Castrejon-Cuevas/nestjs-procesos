import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Page, Frame } from 'playwright';
import { ReportLoggerService } from '../generador_reporte_ivr_reminder/services/logger.service';
import { EmailImapService } from './services/email-imap.service';
import { CccOnePlaywrightService } from './services/ccc-one-playwright.service';
import {
  BbvaCanalStrategy,
  AttCanalStrategy,
  GmfCanalStrategy,
  TytCanalStrategy,
  ScotCanalStrategy,
} from './strategies';
import { BaseCanalStrategy } from './strategies/base-canal.strategy';
import {
  CorreoResultado,
  ResultadoEjecucion,
} from './interfaces/ccc-one.interface';
import { CANALES, Canal } from './constants/ccc-one.constants';

@Injectable()
export class CccOneService {
  private canalesEstrategias: Map<Canal, BaseCanalStrategy>;

  constructor(
    private logger: ReportLoggerService,
    private emailImapService: EmailImapService,
    private playwrightService: CccOnePlaywrightService,
    private bbvaStrategy: BbvaCanalStrategy,
    private attStrategy: AttCanalStrategy,
    private gmfStrategy: GmfCanalStrategy,
    private tytStrategy: TytCanalStrategy,
    private scotStrategy: ScotCanalStrategy,
  ) {
    this.canalesEstrategias = new Map<Canal, BaseCanalStrategy>([
      ['0001', this.bbvaStrategy],
      ['0008', this.bbvaStrategy],
      ['0002', this.attStrategy],
      ['0009', this.attStrategy],
      ['0003', this.gmfStrategy],
      ['0010', this.gmfStrategy],
      ['0005', this.tytStrategy],
      ['0014', this.tytStrategy],
      ['0004', this.scotStrategy],
      ['0011', this.scotStrategy],
    ]);
  }

  async ejecutar(): Promise<{
    exito: boolean;
    mensaje: string;
    resultados?: ResultadoEjecucion[];
  }> {
    this.logger.info(' Iniciando proceso CCC One para todos los canales');

    const correoResultado = await this.obtenerLinkConReintentos();
    if (correoResultado.status !== 'OK' || !correoResultado.link) {
      const mensaje = `No se pudo obtener el link del correo: ${correoResultado.status}`;
      this.logger.error(` ${mensaje}`);
      return { exito: false, mensaje };
    }

    this.logger.info(` Link obtenido: ${correoResultado.link}`);

    const page = await this.playwrightService.iniciar();
    if (!page) {
      return { exito: false, mensaje: 'No se pudo iniciar el navegador' };
    }

    const loginExitoso = await this.playwrightService.login(page);
    if (!loginExitoso) {
      await this.playwrightService.cerrar();
      return { exito: false, mensaje: 'Error en login de CCC One' };
    }

    try {
      await page.goto(correoResultado.link, { timeout: 30000 });
      this.logger.info(` Navegación exitosa a: ${correoResultado.link}`);
    } catch (error) {
      this.logger.error(` Error navegando al link: ${error.message}`);
      await this.playwrightService.cerrar();
      return {
        exito: false,
        mensaje: 'No se pudo acceder al link de descarga',
      };
    }

    let campaignFrame: Frame | null = null;
    for (const frame of page.frames()) {
      try {
        if (
          (await frame.locator('span.select2-selection--single').count()) > 0
        ) {
          campaignFrame = frame;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!campaignFrame) {
      this.logger.error(' No se encontró el frame de campaña');
      await this.playwrightService.cerrar();
      return { exito: false, mensaje: 'Frame de campaña no encontrado' };
    }

    const resultados: ResultadoEjecucion[] = [];

    for (const canal of CANALES) {
      const estrategia = this.canalesEstrategias.get(canal);
      if (!estrategia) {
        this.logger.warn(` No hay estrategia para canal ${canal}`);
        continue;
      }

      this.logger.info(
        `Procesando canal ${canal} (${estrategia.getNombreCampaña()})`,
      );

      const canalSeleccionado = await estrategia.buscarYSeleccionarCanal(
        page,
        campaignFrame,
      );
      if (!canalSeleccionado) {
        resultados.push({
          canal,
          exito: false,
          mensaje: 'No se pudo seleccionar el canal',
        });
        continue;
      }

      const filtrosFrame = await estrategia.navegarADescargas(
        page,
        campaignFrame,
      );
      if (!filtrosFrame) {
        resultados.push({
          canal,
          exito: false,
          mensaje: 'No se pudo acceder a la sección de descargas',
        });
        continue;
      }

      const filtrosConfigurados =
        await estrategia.configurarFiltros(filtrosFrame);
      if (!filtrosConfigurados) {
        resultados.push({
          canal,
          exito: false,
          mensaje: 'Error configurando filtros de fecha',
        });
        continue;
      }

      const resultado = await estrategia.descargarTrabajos(page, filtrosFrame);

      if (resultado) {
        resultados.push({
          canal,
          exito: true,
          mensaje: 'Reporte generado correctamente',
          archivoGenerado: resultado,
        });
        this.logger.info(` Canal ${canal} procesado exitosamente`);
      } else {
        resultados.push({
          canal,
          exito: false,
          mensaje: 'No se encontraron trabajos para descargar',
        });
        this.logger.warn(` Canal ${canal} sin trabajos`);
      }

      await this.sleep(3000);

      const logoReload = campaignFrame
        .locator('a[href="javascript:AppReload();"]')
        .first();
      if ((await logoReload.count()) > 0) {
        await logoReload.click();
        await page.waitForTimeout(10000);
      }
    }

    await this.playwrightService.cerrar();

    const exitos = resultados.filter((r) => r.exito).length;
    this.logger.info(
      `🎉 Proceso CCC One completado. Éxitos: ${exitos}/${resultados.length}`,
    );

    return {
      exito: exitos > 0,
      mensaje: `Procesados ${resultados.length} canales. Exitosos: ${exitos}`,
      resultados,
    };
  }

  private async obtenerLinkConReintentos(
    maxIntentos: number = 3,
  ): Promise<CorreoResultado> {
    for (let intento = 1; intento <= maxIntentos; intento++) {
      this.logger.info(
        ` Intento ${intento} de ${maxIntentos} para obtener link del correo`,
      );
      const resultado = await this.emailImapService.obtenerLinkReporte();

      if (resultado.status === 'OK' && resultado.link) {
        return resultado;
      }

      this.logger.warn(` Intento ${intento} falló: ${resultado.status}`);

      if (intento < maxIntentos) {
        await this.sleep(10000);
      }
    }

    return { status: 'TIMEOUT' };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  //@Cron('0 7 * * *', {
  //  timeZone: 'America/Mexico_City',
  //})
  async ejecutarAutomatico() {
    this.logger.info(' Ejecución automática programada para CCC One (7:00 AM)');
    const resultado = await this.ejecutar();
    this.logger.info(` Resultado: ${resultado.mensaje}`);
    return resultado;
  }
}
