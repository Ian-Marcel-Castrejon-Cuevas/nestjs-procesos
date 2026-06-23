import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Repository, Not, Like, Between } from 'typeorm';
import { LlamadaTransformadaDto } from './dto/reporte-inbound.dto';
import { LlamadaInbound } from './entities/llamada-inbound.entity';
import { ExcelHelper } from './utils/excel-helper';

@Injectable()
export class EnvioInboundService {
  private readonly logger = new Logger(EnvioInboundService.name);
  private transporter: nodemailer.Transporter;
  private networkPath: string;

  constructor(
    @InjectRepository(LlamadaInbound)
    private llamadaRepository: Repository<LlamadaInbound>,
    private configService: ConfigService,
  ) {
    this.initTransporter();
    this.networkPath =
      this.configService.get<string>('NETWORK_REPORTE_INB_') || '';
    this.logger.log(`Directorio de red configurado: ${this.networkPath}`);
  }

  private initTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST2'),
      port: parseInt(this.configService.get('SMTP_PORT2') || '25'),
      secure: false,
      ignoreTLS: true,
    });
  }

  @Cron('0 8 * * *', {
    name: 'reporte_inbound_diario',
    timeZone: 'America/Mexico_City',
  })
  async ejecutarReporteDiario() {
    this.logger.log('Iniciando ejecucion programada del reporte Inbound');

    try {
      const fechaAyer = new Date();
      fechaAyer.setDate(fechaAyer.getDate() - 1);
      const fechaStr = fechaAyer.toISOString().split('T')[0];

      await this.generarYEnviarReporte(fechaStr);
      this.logger.log('Reporte Inbound enviado exitosamente');
    } catch (error) {
      this.logger.error(
        `Error al ejecutar reporte programado: ${error.message}`,
        error.stack,
      );
    }
  }

  async generarYEnviarReporte(fechaStr: string): Promise<void> {
    const [anio, mes, dia] = fechaStr.split('-').map(Number);

    const fechaInicio = new Date(anio, mes - 1, dia, 0, 0, 0);
    const fechaFin = new Date(anio, mes - 1, dia, 23, 59, 59);

    this.logger.log(`Buscando datos entre: ${fechaInicio} y ${fechaFin}`);
    this.logger.log(`Fecha solicitada: ${fechaStr}`);

    const llamadas = await this.llamadaRepository
      .createQueryBuilder('llamada')
      .where('llamada.FECHA BETWEEN :fechaInicio AND :fechaFin', {
        fechaInicio,
        fechaFin,
      })
      .andWhere('llamada.HERRAMIENTA NOT LIKE :herramienta', {
        herramienta: '%OTRO%',
      })
      .getMany();

    this.logger.log(`Encontradas ${llamadas.length} llamadas`);

    if (llamadas.length === 0) {
      this.logger.warn(`No hay datos para la fecha ${fechaStr}`);
      return;
    }

    const fechasUnicas = [...new Set(llamadas.map((l) => l.FECHA?.toString()))];
    this.logger.log(
      `Fechas en los datos encontrados: ${fechasUnicas.join(', ')}`,
    );

    const llamadasTransformadas = this.transformarDatos(llamadas);
    const excelBuffer = await ExcelHelper.generarReporteExcel(
      llamadasTransformadas,
      new Date(fechaStr),
    );

    const zipBuffer = this.comprimirArchivo(excelBuffer, fechaStr);

    await this.guardarArchivoEnRed(excelBuffer, fechaStr, 'xlsx');

    await this.guardarArchivoEnRed(zipBuffer, fechaStr, 'zip');

    await this.enviarCorreo(zipBuffer, fechaStr);

    this.logger.log(`Archivos guardados:
      Excel: Repo_INB_${fechaStr}.xlsx
      ZIP: Repo_INB_${fechaStr}.zip`);
  }

  private async guardarArchivoEnRed(
    buffer: Buffer,
    fechaStr: string,
    extension: string,
  ): Promise<string> {
    try {
      const fileName = `Repo_INB_${fechaStr}.${extension}`;
      const filePath = path.join(this.networkPath, fileName);

      this.logger.log(`Intentando guardar: ${fileName}`);

      await fs.writeFile(filePath, buffer);

      this.logger.log(`Archivo guardado exitosamente: ${fileName}`);
      return filePath;
    } catch (error) {
      this.logger.error(
        `Error al guardar archivo ${extension}: ${error.message}`,
      );
      this.logger.error(
        `Ruta intentada: ${path.join(this.networkPath, `Repo_INB_${fechaStr}.${extension}`)}`,
      );
      throw error;
    }
  }

  private comprimirArchivo(excelBuffer: Buffer, fechaStr: string): Buffer {
    const zip = new AdmZip();
    const nombreExcel = `Repo_INB_${fechaStr}.xlsx`;
    zip.addFile(nombreExcel, excelBuffer);
    return zip.toBuffer();
  }

  private transformarDatos(
    llamadas: LlamadaInbound[],
  ): LlamadaTransformadaDto[] {
    return llamadas.map((llamada) => ({
      Fecha: new Date(llamada.FECHA),
      Hora: llamada.HORA || '',
      Campaña: llamada.CAMPAÑA || 'Sin campaña',
      Estado_llamada: llamada.ESTADO_DE_LLAMADA || 'Sin estado',
      Status: llamada.ESTATUS || 'Sin estatus',
      Area: llamada.AREA || 'Sin area',
      Med_Contacto: llamada.HERRAMIENTA || 'Sin herramienta',
      DID: llamada.DID || '',
      Origen: llamada.ORIGEN || '',
      Tiempo_llamada: this.parseTiempo(llamada.TIEMPO),
      Id_llamada: llamada.ID_LLAMADA,
      Id_grabación: llamada.ID_GRABACION || '',
    }));
  }

  private parseTiempo(tiempoStr: string): number {
    if (!tiempoStr) return 0;
    const parsed = parseInt(tiempoStr, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

private generarTextoPlanoReporte(fechaStr: string): string {
  const fechaFormateada = fechaStr.split('-').reverse().join('/');

  return `Generacion de reporte automatico

Periodo: ${fechaFormateada}

Documento adjunto: Repo_INB_${fechaStr}.zip

Saludos.

---
Reporte automatizado por Ian`;
}

private generarHtmlReporte(fechaStr: string): string {
  const fechaFormateada = fechaStr.split('-').reverse().join('/');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
      }
      .container {
        padding: 20px;
      }
      .header {
        font-size: 16px;
        margin-bottom: 20px;
      }
      .periodo {
        margin: 15px 0;
      }
      .adjunto {
        margin: 15px 0;
      }
      .saludo {
        margin-top: 20px;
      }
      .firma {
        margin-top: 25px;
        padding-top: 10px;
        font-size: 10px;
        color: #888;
        border-top: 1px solid #eee;
        font-style: italic;
      }
      strong {
        color: #2c3e50;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <strong>Generacion de reporte automatico</strong>
      </div>
      
      <div class="periodo">
        <strong>Periodo:</strong> ${fechaFormateada}
      </div>
      
      <div class="adjunto">
        <strong>Documento adjunto:</strong> Repo_INB_${fechaStr}.zip
      </div>
      
      <div class="saludo">
        <strong>Saludos.</strong>
      </div>
      
      <div class="firma">
        Reporte automatizado por Ian
      </div>
    </div>
  </body>
  </html>
`;
}

  private async enviarCorreo(
    zipBuffer: Buffer,
    fechaStr: string,
  ): Promise<void> {
    const plainTextContent = this.generarTextoPlanoReporte(fechaStr);
    const htmlContent = this.generarHtmlReporte(fechaStr);

    const mailOptions = {
      from: this.configService.get('SMTP_FROM2'),
      to: this.configService.get('SMTP_TO2'),
      cc: this.configService.get('SMTP_CC2') || undefined,
      subject: `Reporte automatico Inbound - ${fechaStr}`,
      text: plainTextContent,
      html: htmlContent,
      attachments: [
        {
          filename: `Repo_INB_${fechaStr}.zip`,
          content: zipBuffer,
          contentType: 'application/zip',
        },
      ],
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Correo enviado a ${this.configService.get('SMTP_TO2')}`);
  }

  async probarReporte(fechaStr: string): Promise<string> {
    const fechaEjecucion = new Date();
    this.logger.log(
      '════════════════════════════════════════════════════════════',
    );
    this.logger.log(`EJECUCION MANUAL DEL REPORTE INBOUND`);
    this.logger.log(
      `Fecha/Hora de ejecucion: ${fechaEjecucion.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`,
    );
    this.logger.log(`Timestamp: ${fechaEjecucion.toISOString()}`);
    this.logger.log(`Fecha solicitada para el reporte: ${fechaStr}`);
    this.logger.log(
      '════════════════════════════════════════════════════════════',
    );

    const inicio = Date.now();
    await this.generarYEnviarReporte(fechaStr);
    const duracion = Date.now() - inicio;

    this.logger.log(
      '════════════════════════════════════════════════════════════',
    );
    this.logger.log(`EJECUCION MANUAL COMPLETADA`);
    this.logger.log(`Duracion total: ${duracion}ms`);
    this.logger.log(
      `Finalizacion: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`,
    );
    this.logger.log(
      '════════════════════════════════════════════════════════════',
    );

    return `Reporte generado para fecha ${fechaStr}. Ejecutado el ${fechaEjecucion.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`;
  }
}
