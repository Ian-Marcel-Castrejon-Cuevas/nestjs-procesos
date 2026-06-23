import { Page, Frame } from 'playwright';
import * as fs from 'fs';
import { ReportLoggerService } from '../../generador_reporte_ivr_reminder/services/logger.service';
import {
  TIMEOUT_CONFIG_CCC,
  CAMPAÑAS_MAP,
  Canal,
} from '../constants/ccc-one.constants';

export abstract class BaseCanalStrategy {
  protected todayStr: string;
  protected descargasDir: string = './Descargas';

  constructor(
    protected canal: Canal,
    protected logger: ReportLoggerService,
  ) {
    const today = new Date();
    this.todayStr = today.toISOString().split('T')[0];

    if (!fs.existsSync(this.descargasDir)) {
      fs.mkdirSync(this.descargasDir, { recursive: true });
    }
  }

  abstract getNombreCampaña(): string;

  abstract necesitaZipYCorreo(): boolean;

  async buscarYSeleccionarCanal(page: Page, frame: Frame): Promise<boolean> {
    try {
      const selector = frame.locator('span.select2-selection--single');
      if ((await selector.count()) === 0) {
        this.logger.error(` No se encontró el selector de campaña en el frame`);
        return false;
      }
      await selector.first().click();

      const searchInput = frame.locator('input.select2-search__field');
      await searchInput.waitFor({
        state: 'visible',
        timeout: TIMEOUT_CONFIG_CCC.SEARCH_TIMEOUT_MS,
      });
      await searchInput.fill(this.canal);

      await frame.waitForSelector('li.select2-results__option', {
        timeout: TIMEOUT_CONFIG_CCC.SEARCH_TIMEOUT_MS,
      });

      const opciones = frame.locator('li.select2-results__option');
      const opcionCount = await opciones.count();
      let encontrado = false;

      for (let i = 0; i < opcionCount; i++) {
        try {
          const texto = await opciones.nth(i).innerText();
          if (texto.includes(this.canal)) {
            await opciones.nth(i).click();
            encontrado = true;
            await page.waitForTimeout(5000);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!encontrado) {
        this.logger.warn(`No se encontró el canal ${this.canal}`);
        return false;
      }

      this.logger.info(
        ` Canal ${this.canal} (${this.getNombreCampaña()}) seleccionado`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        ` Error seleccionando canal ${this.canal}: ${error.message}`,
      );
      return false;
    }
  }

  async navegarADescargas(page: Page, frame: Frame): Promise<Frame | null> {
    try {
      const menuButton = frame.locator('i.fa-bars').nth(0);
      if ((await menuButton.count()) === 0) {
        this.logger.error(' No se encontró el botón de menú');
        return null;
      }
      await menuButton.click();
      await page.waitForTimeout(2000);

      const monitoringOption = frame.locator('a:has(i.fa-chart-mixed)');
      if ((await monitoringOption.count()) === 0) {
        this.logger.error(' No se encontró la opción de monitoreo');
        return null;
      }
      await monitoringOption.waitFor({
        state: 'visible',
        timeout: TIMEOUT_CONFIG_CCC.PAGE_LOAD_WAIT_MS,
      });
      await monitoringOption.click();
      await page.waitForTimeout(1000);

      const downloadsOption = frame.locator('#aSublevelOption_37');
      if ((await downloadsOption.count()) === 0) {
        this.logger.error(' No se encontró la opción de descargas');
        return null;
      }
      await downloadsOption.waitFor({
        state: 'visible',
        timeout: TIMEOUT_CONFIG_CCC.PAGE_LOAD_WAIT_MS,
      });
      await downloadsOption.click();
      await page.waitForTimeout(3000);

      for (const f of page.frames()) {
        try {
          const label = f.locator(
            'label:has(input[data-filter="job_completed"])',
          );
          if ((await label.count()) > 0) {
            this.logger.info(' Frame de filtros encontrado');
            return f;
          }
        } catch (error) {
          continue;
        }
      }

      this.logger.error(' No se encontró el frame con los filtros de trabajos');
      return null;
    } catch (error) {
      this.logger.error(` Error navegando a descargas: ${error.message}`);
      return null;
    }
  }

  async configurarFiltros(frame: Frame): Promise<boolean> {
    try {
      const completedLabel = frame.locator(
        'label:has(input[data-filter="job_completed"])',
      );
      if ((await completedLabel.count()) === 0) {
        this.logger.error(' No se encontró el filtro de "Completado"');
        return false;
      }
      await completedLabel.waitFor({
        state: 'attached',
        timeout: TIMEOUT_CONFIG_CCC.PAGE_LOAD_WAIT_MS,
      });

      const completedCheckbox = frame.locator(
        'input[data-filter="job_completed"]',
      );
      if (
        (await completedCheckbox.count()) > 0 &&
        !(await completedCheckbox.isChecked())
      ) {
        await completedLabel.click();
        await frame.waitForTimeout(2000);
      }

      const dateInput = frame.locator('#txtDateFilterFrom');
      if ((await dateInput.count()) === 0) {
        this.logger.error(' No se encontró el campo de fecha');
        return false;
      }
      await dateInput.waitFor({
        state: 'visible',
        timeout: TIMEOUT_CONFIG_CCC.PAGE_LOAD_WAIT_MS,
      });
      await dateInput.fill(this.todayStr);
      await frame.waitForTimeout(2000);

      const searchButton = frame.locator('#btnBackgridSearch-BGJobs');
      if ((await searchButton.count()) === 0) {
        this.logger.error(' No se encontró el botón de búsqueda');
        return false;
      }
      await searchButton.waitFor({
        state: 'visible',
        timeout: TIMEOUT_CONFIG_CCC.PAGE_LOAD_WAIT_MS,
      });
      await searchButton.click();
      await frame.waitForTimeout(3000);

      return true;
    } catch (error) {
      this.logger.error(` Error configurando filtros: ${error.message}`);
      return false;
    }
  }

  protected async procesarFila(
    page: Page,
    row: any,
    filaIndex: number,
    fechaDesde: string,
    fechaHasta: string,
  ): Promise<string | false> {
    try {
      const fechaAyer = new Date();
      fechaAyer.setDate(fechaAyer.getDate() - 1);
      const fechaAyerStr = fechaAyer
        .toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        .replace(/\//g, '-');

      const downloadButton = row.locator('td:nth-child(8) button');

      if (!(await downloadButton.isEnabled())) {
        this.logger.warn(
          `Botón de descarga deshabilitado para fila ${filaIndex + 1}`,
        );
        return false;
      }

      const downloadPromise = page.waitForEvent('download', {
        timeout: TIMEOUT_CONFIG_CCC.DOWNLOAD_TIMEOUT_MS,
      });
      await downloadButton.click();
      const download = await downloadPromise;

      const campaña = this.getNombreCampaña();
      const nombreArchivo = `Reporte_BLASTER_CCCONE_${this.canal}-${campaña}_${fechaAyerStr}.csv`;
      const rutaDescarga = `${this.descargasDir}/${nombreArchivo}`;

      await download.saveAs(rutaDescarga);
      this.logger.info(`Archivo descargado: ${nombreArchivo}`);

      return rutaDescarga;
    } catch (error) {
      this.logger.error(
        ` Error en descarga de fila ${filaIndex + 1}: ${error.message}`,
      );
      return false;
    }
  }

  abstract descargarTrabajos(
    page: Page,
    frame: Frame,
  ): Promise<string | string[] | false>;
}
