import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EnvioInboundService } from './envio-inbound.service';

@Controller('envio-inbound')
/**
 * Controlador para endpoints de generación y prueba del reporte Inbound.
 */
export class EnvioInboundController {
  /**
   * Constructor.
   * @param envioInboundService Servicio que expone las operaciones de generación/prueba de reporte.
   */
  constructor(private readonly envioInboundService: EnvioInboundService) {}

  private normalizarFecha(fechaStr: string): string {
    if (fechaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return fechaStr;
    }

    if (fechaStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const partes = fechaStr.split('-');
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }

    if (fechaStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const partes = fechaStr.split('/');
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }

    return fechaStr;
  }

  private obtenerFechaAyerMexico(): string {
    const ahora = new Date();

    const fechaMexico = new Date(
      ahora.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }),
    );

    fechaMexico.setDate(fechaMexico.getDate() - 1);

    const anio = fechaMexico.getFullYear();
    const mes = String(fechaMexico.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaMexico.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  @Post('generar')
  async generarReporteManual(@Query('fecha') fechaStr?: string) {
    let fecha = fechaStr;

    if (!fecha) {
      fecha = this.obtenerFechaAyerMexico();
    } else {
      fecha = this.normalizarFecha(fecha);
    }

    await this.envioInboundService.generarYEnviarReporte(fecha);
    return {
      message: `Reporte generado para fecha: ${fecha}`,
      success: true,
    };
  }

  @Get('probar/:fecha')
  async probar(@Param('fecha') fechaStr: string) {
    const fechaNormalizada = this.normalizarFecha(fechaStr);
    return await this.envioInboundService.probarReporte(fechaNormalizada);
  }

  @Get('probar-ayer')
  async probarAyer() {
    const fechaStr = this.obtenerFechaAyerMexico();
    return await this.envioInboundService.probarReporte(fechaStr);
  }

  @Get('fecha-actual')
  async getFechaActual() {
    const ahora = new Date();
    const fechaMexico = new Date(
      ahora.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }),
    );

    return {
      fecha_utc: ahora.toISOString(),
      fecha_mexico: fechaMexico.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
      }),
      ayer_mexico: this.obtenerFechaAyerMexico(),
    };
  }
}
