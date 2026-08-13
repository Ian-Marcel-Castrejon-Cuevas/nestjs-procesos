import { Injectable } from '@nestjs/common';
import { Page, Frame } from 'playwright';
import { BaseCanalStrategy } from './base-canal.strategy';
import { ReportLoggerService } from '../../generador_reporte_ivr_reminder/services/logger.service';
import { TIMEOUT_CONFIG_CCC, Canal } from '../constants/ccc-one.constants';
import { CccOneStorageService } from '../services/ccc-one-storage.service';
import { CccOneZipService } from '../services/ccc-one-zip.service';
import { CccOneEmailService } from '../services/ccc-one-email.service';

@Injectable()
/**
 * Estrategia para el canal SCOT: maneja descargas y particularidades de SCOT.
 */
export class ScotCanalStrategy extends BaseCanalStrategy {
  constructor(
    logger: ReportLoggerService,
    private storageService: CccOneStorageService,
    private zipService: CccOneZipService,
    private emailService: CccOneEmailService,
  ) {
    super('0004' as Canal, logger);
  }

  getNombreCampaña(): string {
    return 'SCOT';
  }

  necesitaZipYCorreo(): boolean {
    return true;
  }

  async descargarTrabajos(
    page: Page,
    frame: Frame,
  ): Promise<string | string[] | false> {
    let pagina = 1;
    const maxPaginas = 10;

    while (pagina <= maxPaginas) {
      this.logger.info(` [SCOT] Revisando página ${pagina}...`);

      try {
        const tabla = frame.locator('#divBackgrid-BGJobs table tbody');
        await tabla.waitFor({
          state: 'attached',
          timeout: TIMEOUT_CONFIG_CCC.PAGE_LOAD_WAIT_MS,
        });

        const rows = frame.locator('#divBackgrid-BGJobs table tbody tr');
        const rowCount = await rows.count();

        if (rowCount === 0) {
          this.logger.warn(' No hay registros en esta página.');
          break;
        }

        for (let i = 0; i < rowCount; i++) {
          try {
            const row = rows.nth(i);

            const tipo = await row
              .locator('td:nth-child(2) span')
              .innerText()
              .catch(() => '');
            const fechaDesde = (
              await row
                .locator('td:nth-child(4)')
                .innerText()
                .catch(() => '')
            ).slice(0, 10);
            const fechaHasta = (
              await row
                .locator('td:nth-child(5)')
                .innerText()
                .catch(() => '')
            ).slice(0, 10);
            const solicitadoPor = await row
              .locator('td:nth-child(9) span')
              .innerText()
              .catch(() => '');

            if (
              tipo === 'Historial de Llamadas - Lista/Disposiciones/Notas' &&
              fechaDesde &&
              fechaDesde < this.todayStr &&
              fechaHasta &&
              fechaHasta < this.todayStr &&
              solicitadoPor === 'ASECON PROCESOS'
            ) {
              this.logger.info(
                ` [SCOT] Descargando fila ${i + 1}: ${fechaDesde} - ${fechaHasta}`,
              );

              const rutaDescarga = await this.procesarFila(
                page,
                row,
                i,
                fechaDesde,
                fechaHasta,
              );

              if (rutaDescarga) {
                const resultado = await this.storageService.moverArchivo(
                  rutaDescarga,
                  this.canal,
                );

                if (resultado) {
                  this.logger.info(' [SCOT] Convirtiendo a ZIP');
                  const archivos = Array.isArray(resultado)
                    ? resultado
                    : [resultado];

                  const archivosZip: string[] = [];
                  for (const archivo of archivos) {
                    const zip = this.zipService.convertirAZip(archivo);
                    if (zip) {
                      archivosZip.push(zip);
                    }
                  }

                  if (archivosZip.length > 0) {
                    this.logger.info(
                      ' [SCOT] Enviando correo con ZIP adjunto...',
                    );
                    await this.emailService.enviarCorreo(
                      this.canal,
                      archivosZip,
                    );
                    return archivosZip;
                  } else {
                    this.logger.warn(' No se pudo crear el ZIP');
                    return resultado;
                  }
                }
              }
            }
          } catch (rowError) {
            this.logger.warn(`Error procesando fila ${i}: ${rowError.message}`);
            continue;
          }
        }

        const nextLi = frame
          .locator('.backgrid-paginator li')
          .filter({ has: frame.locator("a[title='Siguiente']") })
          .first();

        const classes = await nextLi
          .getAttribute('class')
          .catch(() => 'disabled');

        if (classes && classes.includes('disabled')) {
          this.logger.info(' No hay más páginas disponibles.');
          break;
        } else {
          await nextLi.locator('a').click();
          await frame.waitForTimeout(2000);
          pagina++;
        }
      } catch (error) {
        this.logger.error(` Error en página ${pagina}: ${error.message}`);
        break;
      }
    }

    this.logger.info(' No se encontraron trabajos para descargar en SCOT.');
    return false;
  }
}
