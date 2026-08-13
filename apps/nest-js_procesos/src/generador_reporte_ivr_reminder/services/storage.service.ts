import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { ReportLoggerService } from './logger.service';
import { DateUtils } from '../utils/date.utils';
import { REPORT_TYPES, REPORT_CONFIGS } from '../constants/report.constants';

@Injectable()
/**
 * Servicio para mover archivos temporales a almacenamiento de red.
 */
export class StorageService {
  /**
   * Constructor.
   * @param logger Servicio de logging para operaciones de almacenamiento.
   */
  constructor(private logger: ReportLoggerService) {}

  async moveToNetwork(tempPath: string, reportType: string): Promise<string> {
    try {
      const stats = await fs.stat(tempPath);
    } catch (error) {
      throw new Error(`Archivo temporal no encontrado: ${tempPath}`);
    }

    const config = REPORT_CONFIGS[reportType as keyof typeof REPORT_CONFIGS];
    if (!config) {
      throw new Error(`Configuración no encontrada para ${reportType}`);
    }

    const filename = path.basename(tempPath);
    const yesterday = DateUtils.getYesterday();
    const monthFolder = DateUtils.getMonthYearFolder(yesterday);

    const targetDir = path.join(config.networkBase, monthFolder);
    const targetPath = path.join(targetDir, filename);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(tempPath);
    } catch (error) {
      this.logger.error(`Error leyendo archivo temporal: ${error.message}`);
      throw error;
    }

    try {
      await this.createDirectoryRecursive(targetDir);
    } catch (error) {
      this.logger.error(`Error creando directorio destino: ${error.message}`);

      try {
        this.logger.info(
          `Intentando método alternativo para crear directorio...`,
        );
        await this.createUNCDirectory(targetDir);
      } catch (altError) {
        this.logger.error(
          `También falló método alternativo: ${altError.message}`,
        );
        throw error;
      }
    }

    try {
      await fs.writeFile(targetPath, fileBuffer);
    } catch (error) {
      this.logger.error(`Error escribiendo archivo destino: ${error.message}`);

      try {
        this.logger.info(`Intentando método alternativo para escribir...`);
        fsSync.writeFileSync(targetPath, fileBuffer);
        this.logger.info(`Archivo escrito con método alternativo`);
      } catch (altError) {
        this.logger.error(
          ` También falló escritura alternativa: ${altError.message}`,
        );
        throw error;
      }
    }

    try {
      const stats = await fs.stat(targetPath);
      if (stats.size === fileBuffer.length) {
        this.logger.info(`Verificación exitosa: ${stats.size} bytes coinciden`);
      } else {
        this.logger.warn(
          `Tamaño incorrecto: esperado ${fileBuffer.length}, actual ${stats.size}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar el archivo destino: ${error.message}`,
      );
    }

    try {
      await fs.unlink(tempPath);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar archivo temporal: ${error.message}`,
      );
    }

    this.logger.info(`Archivo final en: ${targetPath}`);

    return targetPath;
  }

  private async createDirectoryRecursive(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      this.logger.error(`Error en mkdir recursivo: ${error.message}`);
      throw error;
    }
  }

  private async createUNCDirectory(uncPath: string): Promise<void> {
    const parts = uncPath.split('\\');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '') continue;

      if (i === 0 && parts[i].startsWith('\\\\')) {
        currentPath = parts[i];
      } else if (currentPath === '') {
        currentPath = parts[i];
      } else {
        currentPath = `${currentPath}\\${parts[i]}`;
      }

      if (currentPath && !fsSync.existsSync(currentPath)) {
        try {
          fsSync.mkdirSync(currentPath);
        } catch (error) {
          if (error.code !== 'EEXIST') {
            this.logger.warn(
              `No se pudo crear ${currentPath}: ${error.message}`,
            );
          }
        }
      }
    }
  }

  async saveTempFile(filename: string, buffer: Buffer): Promise<string> {
    const tempDir = './temp_downloads';

    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      this.logger.warn(`Error creando directorio temporal: ${error.message}`);
    }

    const filePath = path.join(tempDir, filename);

    try {
      await fs.writeFile(filePath, buffer);

      const stats = await fs.stat(filePath);

      return filePath;
    } catch (error) {
      this.logger.error(` Error guardando archivo temporal: ${error.message}`);
      throw error;
    }
  }
}
