import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { CccOneService } from './ccc-one.service';
import { ReportLoggerService } from '../generador_reporte_ivr_reminder/services/logger.service';

@Controller('api/ccc-one')
/**
 * Controlador para operaciones relacionadas con CCC One (endpoints HTTP).
 */
export class CccOneController {
  constructor(
    private cccOneService: CccOneService,
    private logger: ReportLoggerService,
  ) {}

  @Post('ejecutar')
  @HttpCode(HttpStatus.ACCEPTED)
  async ejecutar() {
    this.logger.info(' Solicitud manual de ejecución CCC One');
    const resultado = await this.cccOneService.ejecutar();

    return {
      success: resultado.exito,
      message: resultado.mensaje,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('estado')
  async obtenerEstado() {
    return {
      servicio: 'CCC One Report Downloader',
      status: 'operativo',
      canales_soportados: ['SCOT (0004)'],
      programacion: 'Diario a las 7:00 AM (hora México)',
    };
  }
}
