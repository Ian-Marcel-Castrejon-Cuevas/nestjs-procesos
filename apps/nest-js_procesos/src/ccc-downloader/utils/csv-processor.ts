import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as fastCsv from 'fast-csv';
import { createReadStream, createWriteStream } from 'fs';
import { RegistroLlamada } from '../interfaces/ccc-downloader.interface';
import { CuentaConfig } from '../interfaces/ccc-downloader.interface';

@Injectable()
export class CsvProcessor {
  private readonly logger = new Logger(CsvProcessor.name);

  async descomprimirYProcesarCSV(
    rutaZip: string,
    rutaDescarga: string,
    cuentaConfig: CuentaConfig,
    fechaFormateada: string,
  ): Promise<string | null> {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(rutaZip);

      const carpetaTemp = path.join(rutaDescarga, 'temp_extract');
      if (fs.existsSync(carpetaTemp)) {
        fs.rmSync(carpetaTemp, { recursive: true, force: true });
      }
      fs.mkdirSync(carpetaTemp, { recursive: true });

      zip.extractAllTo(carpetaTemp, true);

      const archivosCSV: string[] = [];
      const walkDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (file.toLowerCase().endsWith('.csv')) {
            archivosCSV.push(fullPath);
          }
        }
      };
      walkDir(carpetaTemp);

      if (archivosCSV.length === 0) {
        this.logger.warn('No se encontraron archivos CSV dentro del zip');
        return null;
      }

      this.logger.log(`Se encontraron ${archivosCSV.length} archivos CSV`);
      archivosCSV.sort();

      const columnasNecesarias = [
        'CallID',
        'Type',
        'Campaign',
        'Agent',
        'CallerID',
        'CalledNumber',
        'Destination',
        'AnswerState',
        'AMDStatus',
        'HangupReason',
        'HangupCode',
        'HangupCodeSIP',
        'DurationSeconds',
        'DurationMinutes',
        'BillTimeMinutes',
        'BillRate',
        'BillCost',
        'StartDateTime',
        'AnswerDateTime',
        'HangupDateTime',
        'Lead ID',
        'List ID',
      ];

      const archivosProcesados: string[] = [];

      for (let idx = 0; idx < archivosCSV.length; idx++) {
        const archivoCSV = archivosCSV[idx];
        this.logger.log(
          `Procesando archivo CSV ${idx + 1}: ${path.basename(archivoCSV)}`,
        );

        const sufijo = archivosCSV.length > 1 ? `_${idx + 1}` : '';
        const archivoProcesado = path.join(
          carpetaTemp,
          `procesado${sufijo}.csv`,
        );

        await this.procesarArchivoCSV(
          archivoCSV,
          archivoProcesado,
          cuentaConfig.nombre,
        );

        archivosProcesados.push(archivoProcesado);
      }

      if (archivosProcesados.length === 0) {
        this.logger.warn('No se pudo procesar ningún archivo CSV');
        fs.rmSync(carpetaTemp, { recursive: true, force: true });
        return null;
      }

      const nombreFinal = `${cuentaConfig.nombre}_${fechaFormateada}`;
      const archivosFinales: string[] = [];

      for (let i = 0; i < archivosProcesados.length; i++) {
        const nombreFinalArchivo =
          archivosProcesados.length > 1
            ? `${nombreFinal}_${i + 1}.csv`
            : `${nombreFinal}.csv`;

        const rutaDestino = path.join(
          path.dirname(rutaZip),
          nombreFinalArchivo,
        );
        fs.copyFileSync(archivosProcesados[i], rutaDestino);
        archivosFinales.push(rutaDestino);
      }

      fs.rmSync(carpetaTemp, { recursive: true, force: true });
      fs.unlinkSync(rutaZip);

      return archivosFinales[0] || null;
    } catch (error: any) {
      this.logger.error(`Error al procesar archivo: ${error.message}`);
      return null;
    }
  }

  private async procesarArchivoCSV(
    archivoOrigen: string,
    archivoDestino: string,
    nombreCuenta: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const registros: RegistroLlamada[] = [];

      const stream = createReadStream(archivoOrigen)
        .pipe(
          fastCsv.parse({
            headers: true,
            delimiter: ',',
            ignoreEmpty: true,
            trim: true,
          }),
        )
        .on('data', (data) => {
          try {
            const registro = this.transformarRegistro(data, nombreCuenta);
            registros.push(registro);
          } catch (error: any) {
            this.logger.warn(`Error transformando registro: ${error.message}`);
          }
        })
        .on('end', () => {
          this.guardarCSVProcesado(registros, archivoDestino)
            .then(() => {
              this.logger.log(
                `Archivo procesado: ${path.basename(archivoDestino)}, ${registros.length} registros`,
              );
              resolve();
            })
            .catch(reject);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private transformarRegistro(
    data: any,
    nombreCuenta: string,
  ): RegistroLlamada {
    return {
      Cta: nombreCuenta,
      CallID: data.CallID || '',
      Type: data.Type || '',
      Campaign: data.Campaign || '',
      Agent: data.Agent || '',
      CallerID: data.CallerID || '',
      CalledNumber: data.CalledNumber || '',
      Destination: data.Destination || '',
      AnswerState: data.AnswerState || '',
      AMDStatus: data.AMDStatus || '',
      HangupReason: data.HangupReason || '',
      HangupCode: data.HangupCode ? parseInt(data.HangupCode) : null,
      HangupCodeSIP: data.HangupCodeSIP ? parseInt(data.HangupCodeSIP) : null,
      DurationSeconds: data.DurationSeconds
        ? parseFloat(data.DurationSeconds)
        : null,
      DurationMinutes: data.DurationMinutes
        ? parseFloat(data.DurationMinutes)
        : null,
      BillTimeMinutes: data.BillTimeMinutes
        ? parseFloat(data.BillTimeMinutes)
        : null,
      BillRate: data.BillRate ? parseFloat(data.BillRate) : null,
      BillCost: data.BillCost ? parseFloat(data.BillCost) : null,
      StartDateTime: data.StartDateTime
        ? this.parseFecha(data.StartDateTime)
        : null,
      AnswerDateTime: data.AnswerDateTime || null,
      HangupDateTime: data.HangupDateTime || null,
      LeadID: data['Lead ID'] || null,
      ListID: data['List ID'] || null,
      Hora: this.extraerHora(data.StartDateTime),
    };
  }

  private parseFecha(fechaStr: string): Date | null {
    if (!fechaStr) return null;
    try {
      const partes = fechaStr.split(' ');
      const fecha = partes[0];
      const partesFecha = fecha.split('-');
      if (partesFecha.length === 3) {
        return new Date(
          `${partesFecha[0]}-${partesFecha[1]}-${partesFecha[2]}`,
        );
      }
      return new Date(fecha);
    } catch {
      return null;
    }
  }

  private extraerHora(fechaStr: string): string | null {
    if (!fechaStr) return null;
    const match = fechaStr.match(/(\d{2}:\d{2}:\d{2})/);
    if (match) return this.normalizarHora(match[1]);
    const match2 = fechaStr.match(/(\d{2}:\d{2})/);
    if (match2) return this.normalizarHora(`${match2[1]}:00`);
    return null;
  }

  private normalizarHora(hora: unknown): string | null {
    if (typeof hora !== 'string') return null;

    const valor = hora.trim();
    const match = valor.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const horas = Number(match[1]);
    const minutos = Number(match[2]);
    const segundos = Number(match[3] || '00');
    if (horas > 23 || minutos > 59 || segundos > 59) return null;

    return `${match[1]}:${match[2]}:${match[3] || '00'}`;
  }

  private guardarCSVProcesado(
    registros: RegistroLlamada[],
    archivoDestino: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = createWriteStream(archivoDestino);
      ws.on('finish', resolve);
      ws.on('error', reject);

      const headers = [
      'Cta',
      'CallID',
      'Type',
      'Campaign',
      'Agent',
      'CallerID',
      'CalledNumber',
      'Destination',
      'AnswerState',
      'AMDStatus',
      'HangupReason',
      'HangupCode',
      'HangupCodeSIP',
      'DurationSeconds',
      'DurationMinutes',
      'BillTimeMinutes',
      'BillRate',
      'BillCost',
      'StartDateTime',
      'AnswerDateTime',
      'HangupDateTime',
      'Lead ID',
      'List ID',
      'Hora',
      ];

      const csvStream = fastCsv.format({ headers, delimiter: ',' });
      csvStream.on('error', reject);
      csvStream.pipe(ws);

      for (const registro of registros) {
        csvStream.write({
        Cta: registro.Cta,
        CallID: registro.CallID,
        Type: registro.Type,
        Campaign: registro.Campaign,
        Agent: registro.Agent,
        CallerID: registro.CallerID,
        CalledNumber: registro.CalledNumber,
        Destination: registro.Destination,
        AnswerState: registro.AnswerState,
        AMDStatus: registro.AMDStatus,
        HangupReason: registro.HangupReason,
        HangupCode: registro.HangupCode,
        HangupCodeSIP: registro.HangupCodeSIP,
        DurationSeconds: registro.DurationSeconds,
        DurationMinutes: registro.DurationMinutes,
        BillTimeMinutes: registro.BillTimeMinutes,
        BillRate: registro.BillRate,
        BillCost: registro.BillCost,
        StartDateTime: registro.StartDateTime,
        AnswerDateTime: registro.AnswerDateTime,
        HangupDateTime: registro.HangupDateTime,
        'Lead ID': registro.LeadID,
        'List ID': registro.ListID,
        Hora: registro.Hora,
        });
      }

      csvStream.end();
    });
  }

  async leerCSVProcesado(rutaCSV: string): Promise<RegistroLlamada[]> {
    return new Promise((resolve, reject) => {
      const registros: RegistroLlamada[] = [];

      createReadStream(rutaCSV)
        .pipe(
          fastCsv.parse({
            headers: true,
            delimiter: ',',
            ignoreEmpty: true,
            trim: true,
          }),
        )
        .on('data', (data) => {
          try {
            const registro: RegistroLlamada = {
              Cta: data.Cta,
              CallID: data.CallID,
              Type: data.Type,
              Campaign: data.Campaign,
              Agent: data.Agent,
              CallerID: data.CallerID,
              CalledNumber: data.CalledNumber,
              Destination: data.Destination,
              AnswerState: data.AnswerState,
              AMDStatus: data.AMDStatus,
              HangupReason: data.HangupReason,
              HangupCode: data.HangupCode ? parseInt(data.HangupCode) : null,
              HangupCodeSIP: data.HangupCodeSIP
                ? parseInt(data.HangupCodeSIP)
                : null,
              DurationSeconds: data.DurationSeconds
                ? parseFloat(data.DurationSeconds)
                : null,
              DurationMinutes: data.DurationMinutes
                ? parseFloat(data.DurationMinutes)
                : null,
              BillTimeMinutes: data.BillTimeMinutes
                ? parseFloat(data.BillTimeMinutes)
                : null,
              BillRate: data.BillRate ? parseFloat(data.BillRate) : null,
              BillCost: data.BillCost ? parseFloat(data.BillCost) : null,
              StartDateTime: data.StartDateTime
                ? new Date(data.StartDateTime)
                : null,
              AnswerDateTime: data.AnswerDateTime,
              HangupDateTime: data.HangupDateTime,
              LeadID: data['Lead ID'],
              ListID: data['List ID'],
              Hora: this.normalizarHora(data.Hora),
            };
            registros.push(registro);
          } catch (error: any) {
            this.logger.warn(`Error transformando registro: ${error.message}`);
          }
        })
        .on('end', () => {
          resolve(registros);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
}
