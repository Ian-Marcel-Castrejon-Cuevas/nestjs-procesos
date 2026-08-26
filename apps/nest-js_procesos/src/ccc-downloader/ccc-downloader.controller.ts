import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CccDownloaderService } from './ccc-downloader.service';
import {
  EjecutarReporteDto,
  EjecutarCuentaDto,
} from './dto/ccc-downloader.dto';

@Controller('ccc-downloader')
export class CccDownloaderController {
  constructor(private readonly cccDownloaderService: CccDownloaderService) {}

  @Post('ejecutar')
  @HttpCode(HttpStatus.OK)
  async ejecutarProcesoCompleto(@Body() dto?: EjecutarReporteDto) {
    const fecha = dto?.fecha;
    const resultado =
      await this.cccDownloaderService.ejecutarProcesoCompleto(fecha);
    return {
      success: true,
      message: 'Proceso completado',
      data: resultado,
    };
  }

  @Post('cuenta')
  @HttpCode(HttpStatus.OK)
  async ejecutarCuentaUnica(@Body() dto: EjecutarCuentaDto) {
    const resultado = await this.cccDownloaderService.ejecutarCuentaUnica(
      dto.customerId,
      dto.fecha,
    );
    return {
      success: resultado.exitoso,
      message: resultado.exitoso
        ? 'Cuenta procesada exitosamente'
        : 'Error al procesar cuenta',
      data: resultado,
    };
  }

  @Get('cuentas')
  getCuentas() {
    const cuentas = [
      { id: '2625', nombre: 'CCC-ASECON-CMX-0001' },
      { id: '2626', nombre: 'CCC-ASECON-CMX-0002' },
      { id: '2627', nombre: 'CCC-ASECON-CMX-0003' },
      { id: '2628', nombre: 'CCC-ASECON-CMX-0004' },
      { id: '2995', nombre: 'CCC-ASECON-CMX-0007' },
      { id: '2996', nombre: 'CCC-ASECON-CMX-0008' },
      { id: '2997', nombre: 'CCC-ASECON-CMX-0009' },
      { id: '2998', nombre: 'CCC-ASECON-CMX-0010' },
      { id: '2999', nombre: 'CCC-ASECON-CMX-0011' },
    ];
    return {
      success: true,
      data: cuentas,
    };
  }

  @Get('fecha-ayer')
  getFechaAyer() {
    const fechaAyer = new Date();
    fechaAyer.setDate(fechaAyer.getDate() - 1);
    const fechaStr = fechaAyer.toISOString().split('T')[0];
    return {
      success: true,
      data: {
        fecha: fechaStr,
        fechaMexico: fechaAyer.toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
        }),
      },
    };
  }
}
