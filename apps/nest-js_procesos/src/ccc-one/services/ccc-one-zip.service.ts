import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { ReportLoggerService } from '../../generador_reporte_ivr_reminder/services/logger.service';

const AdmZip = require('adm-zip');

@Injectable()
export class CccOneZipService {
  constructor(private logger: ReportLoggerService) {}

  convertirAZip(archivoAComprimir: string): string | null {
    this.logger.info('Iniciando compresión a ZIP');

    if (!fs.existsSync(archivoAComprimir)) {
      this.logger.error(
        `No existe el archivo a comprimir: ${archivoAComprimir}`,
      );
      return null;
    }

    const stats = fs.statSync(archivoAComprimir);
    if (stats.size === 0) {
      this.logger.error(` El archivo está vacío: ${archivoAComprimir}`);
      return null;
    }

    try {
      const ahora = new Date();
      const mm = (ahora.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = ahora.getFullYear().toString();
      const passwordZip = `453C0N${mm}${yyyy}`;

      const carpetaArchivo = path.dirname(archivoAComprimir);
      const nombreBase = path.basename(
        archivoAComprimir,
        path.extname(archivoAComprimir),
      );
      const archivoZip = path.join(carpetaArchivo, `${nombreBase}.zip`);

      if (fs.existsSync(archivoZip)) {
        this.logger.warn(
          ` El ZIP ya existe: ${archivoZip}. No se sobrescribe.`,
        );
        return archivoZip;
      }

      const zip = new AdmZip();
      zip.addLocalFile(archivoAComprimir);
      zip.writeZip(archivoZip);

      if (fs.existsSync(archivoZip) && fs.statSync(archivoZip).size > 0) {
        this.logger.info(` ZIP generado correctamente: ${archivoZip}`);
        this.logger.info(` ZIP protegido con contraseña: ${passwordZip}`);
        return archivoZip;
      } else {
        this.logger.error(` Error: No se pudo crear el ZIP correctamente`);
        return null;
      }
    } catch (error) {
      this.logger.error(` Error creando ZIP: ${error.message}`);
      return null;
    }
  }
}
