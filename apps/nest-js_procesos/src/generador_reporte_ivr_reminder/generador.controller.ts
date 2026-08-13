import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GeneradorService } from './generador.service';
import { ReportLoggerService } from './services/logger.service';

@Controller('api/ivr-reminder')
/**
 * Controlador para invocar generación de reportes IVR desde HTTP.
 */
export class GeneradorController {
  constructor(
    private generadorService: GeneradorService,
    private logger: ReportLoggerService,
  ) {}

  @Post('generar-todos')
  @HttpCode(HttpStatus.ACCEPTED)
  async generarTodos(@Query('skipEmail') skipEmail?: string) {
    const result = await this.generadorService.generarTodos({
      skipEmail: skipEmail === 'true',
    });

    return {
      message: 'Generación de reportes completada',
      results: result,
      resumen: {
        total: result.length,
        exitosos: result.filter((r) => r.success).length,
        fallidos: result.filter((r) => !r.success).length,
      },
    };
  }

  @Post('generar/:tipo')
  @HttpCode(HttpStatus.ACCEPTED)
  async generarUno(
    @Param('tipo') tipo: string,
    @Query('skipEmail') skipEmail?: string,
  ) {
    const tiposValidos = ['BBVA', 'BBVA_VIG', 'ATT', 'GMF'];
    if (!tiposValidos.includes(tipo.toUpperCase())) {
      return {
        error: 'Tipo de reporte no válido',
        validos: tiposValidos,
      };
    }

    const resultado = await this.generadorService.generarUno(tipo, {
      skipEmail: skipEmail === 'true',
    });

    return resultado;
  }

  @Get('estado')
  async obtenerEstado() {
    return this.generadorService.obtenerEstado();
  }

  @Get('tipos')
  async obtenerTipos() {
    return {
      tipos: ['BBVA', 'BBVA_VIG', 'ATT', 'GMF'],
      descripcion: 'Tipos de reportes disponibles para generar',
    };
  }
}
