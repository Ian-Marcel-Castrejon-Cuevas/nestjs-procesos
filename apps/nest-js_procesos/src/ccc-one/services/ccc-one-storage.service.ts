import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { ReportLoggerService } from '../../generador_reporte_ivr_reminder/services/logger.service';
import {
  RUTAS_RED_MAP,
  Canal,
  LIMITE_FILAS_CSV,
} from '../constants/ccc-one.constants';

@Injectable()
/**
 * Servicio para mover/almacenar archivos generados por CCC One en la red.
 */
export class CccOneStorageService {
  /**
   * Constructor.
   * @param logger Servicio de logging para operaciones de almacenamiento CCC One.
   */
  constructor(private logger: ReportLoggerService) {}

  async moverArchivo(
    rutaOrigen: string,
    canal: Canal,
  ): Promise<string | string[] | false> {
    if (!fsSync.existsSync(rutaOrigen)) {
      this.logger.warn(` El archivo no existe: ${rutaOrigen}`);
      return false;
    }

    const stats = fsSync.statSync(rutaOrigen);
    if (stats.size === 0) {
      this.logger.warn(` El archivo está vacío: ${rutaOrigen}. Eliminando...`);
      await this.eliminarConReintento(rutaOrigen);
      return false;
    }

    const destinoBase = RUTAS_RED_MAP[canal];
    if (!destinoBase) {
      this.logger.warn(` No existe ruta definida para el canal ${canal}`);
      return false;
    }

    const ahora = new Date();
    const meses = [
      'ENERO',
      'FEBRERO',
      'MARZO',
      'ABRIL',
      'MAYO',
      'JUNIO',
      'JULIO',
      'AGOSTO',
      'SEPTIEMBRE',
      'OCTUBRE',
      'NOVIEMBRE',
      'DICIEMBRE',
    ];
    const mesActual = meses[ahora.getMonth()];
    const anioActual = ahora.getFullYear();

    const destinoCarpeta = path.join(destinoBase, `${mesActual} ${anioActual}`);

    try {
      await fs.mkdir(destinoCarpeta, { recursive: true });
    } catch (error) {
      this.logger.error(` Error creando carpeta destino: ${error.message}`);
      return false;
    }

    const nombreBase = path.basename(rutaOrigen, path.extname(rutaOrigen));
    const limite = LIMITE_FILAS_CSV;

    try {
      const totalFilas = await this.contarFilasCSV(rutaOrigen);
      this.logger.info(` Total de registros: ${totalFilas.toLocaleString()}`);

      if (totalFilas > limite) {
        this.logger.warn(
          ` Archivo supera el límite de ${limite.toLocaleString()} filas. Dividiendo...`,
        );
        return await this.dividirCSV(
          rutaOrigen,
          destinoCarpeta,
          nombreBase,
          limite,
        );
      }

      const destino = path.join(destinoCarpeta, `${nombreBase}.csv`);

      if (fsSync.existsSync(destino)) {
        this.logger.warn(
          ` El archivo ya existe en destino: ${destino}. No se sobrescribe.`,
        );
        await this.eliminarConReintento(rutaOrigen);
        return false;
      }

      await fs.rename(rutaOrigen, destino);
      this.logger.info(` Archivo movido a: ${destino}`);
      return destino;
    } catch (error) {
      this.logger.error(` Error procesando CSV: ${error.message}`);
      return false;
    }
  }

  private async contarFilasCSV(ruta: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      const stream = fsSync.createReadStream(ruta);
      let buffer = '';

      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          if (line.trim()) {
            count++;
          }
        }
      });

      stream.on('end', () => {
        if (buffer.trim()) count++;
        resolve(Math.max(0, count - 1));
      });

      stream.on('error', reject);
    });
  }

  private async dividirCSV(
    rutaOrigen: string,
    destinoCarpeta: string,
    nombreBase: string,
    limite: number,
  ): Promise<string[]> {
    const parte1 = path.join(destinoCarpeta, `${nombreBase}_PARTE1.csv`);
    const parte2 = path.join(destinoCarpeta, `${nombreBase}_PARTE2.csv`);

    if (fsSync.existsSync(parte1) || fsSync.existsSync(parte2)) {
      this.logger.warn(' Uno de los archivos ya existe. No se sobrescribe.');
      await this.eliminarConReintento(rutaOrigen);
      return false as any;
    }

    return new Promise((resolve, reject) => {
      let filaActual = 0;
      let streamParte2: fsSync.WriteStream | null = null;
      let headers: string | null = null;
      let primeraFilaParte1 = true;

      const readStream = fsSync.createReadStream(rutaOrigen);
      let buffer = '';

      readStream.on('data', async (chunk) => {
        buffer += chunk.toString();
        let newlineIndex;

        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);

          if (!line.trim()) continue;

          if (headers === null) {
            headers = line;
            continue;
          }

          filaActual++;

          if (filaActual <= limite) {
            if (primeraFilaParte1) {
              await fs.writeFile(parte1, headers + '\n' + line + '\n');
              primeraFilaParte1 = false;
            } else {
              await fs.appendFile(parte1, line + '\n');
            }
          } else {
            if (streamParte2 === null) {
              streamParte2 = fsSync.createWriteStream(parte2);
              streamParte2.write(headers + '\n');
            }
            streamParte2.write(line + '\n');
          }
        }
      });

      readStream.on('end', async () => {
        if (buffer.trim() && headers) {
          filaActual++;
          if (filaActual <= limite) {
            await fs.appendFile(parte1, buffer + '\n');
          } else if (streamParte2) {
            streamParte2.write(buffer + '\n');
          }
        }

        if (streamParte2) {
          streamParte2.end();
        }

        await this.eliminarConReintento(rutaOrigen);
        this.logger.info(` Archivos creados: ${parte1}, ${parte2}`);
        resolve([parte1, parte2]);
      });

      readStream.on('error', reject);
    });
  }

  async eliminarConReintento(
    ruta: string,
    intentos: number = 5,
    espera: number = 2,
  ): Promise<boolean> {
    for (let i = 0; i < intentos; i++) {
      try {
        if (fsSync.existsSync(ruta)) {
          await fs.unlink(ruta);
          this.logger.debug(` Archivo eliminado: ${ruta}`);
        }
        return true;
      } catch (error) {
        this.logger.warn(
          ` Archivo en uso. Reintentando... (${i + 1}/${intentos})`,
        );
        await this.sleep(espera * 1000);
      }
    }
    this.logger.warn(
      ` No se pudo eliminar el archivo después de ${intentos} intentos: ${ruta}`,
    );
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
