import { Controller, Get, Param } from '@nestjs/common';
import { ReporteService } from './reporte.service';

@Controller('api/reporte')
export class ReporteController {
  constructor(private readonly reporteService: ReporteService) {}

  @Get('completo/:fecha')
  async procesarCompleto(@Param('fecha') fecha: string) {
    return this.reporteService.procesarAmbasFuentes(fecha);
  }

  @Get('excel/:fecha')
  async procesarExcel(@Param('fecha') fecha: string) {
    return this.reporteService.procesarReporteExcel(fecha);
  }

  @Get('sql/:fecha')
  async procesarSQL(@Param('fecha') fecha: string) {
    return this.reporteService.procesarReporteSQL(fecha);
  }

  @Get('corregir/:fecha')
  async corregir(@Param('fecha') fecha: string) {
    return this.reporteService.corregirTextos(fecha);
  }

  @Get()
  async procesarAyer() {
    return this.reporteService.procesarReporteAyer();
  }

  @Get('combinado/:fecha')
  async procesarCombinado(@Param('fecha') fecha: string) {
    return this.reporteService.procesarFechaEspecifica(fecha);
  }

  @Get('combinado/ayer')
  async procesarCombinadoAyer() {
    return this.reporteService.procesarReporteAyer();
  }

  @Get('diagnostico/conexiones')
  async diagnosticarConexiones() {
    const resultados: any = {
      destino: { conectado: false, error: null, data: null },
      origen: { conectado: false, error: null, data: null },
      timestamp: new Date().toISOString(),
    };

    try {
      const destino = await this.reporteService.probarConexionDestino();
      resultados.destino.conectado = true;
      resultados.destino.data = destino;
    } catch (error) {
      resultados.destino.error = error.message;
    }

    try {
      const origen = await this.reporteService.probarConexionOrigen();
      resultados.origen.conectado = true;
      resultados.origen.data = origen;
    } catch (error) {
      resultados.origen.error = error.message;
    }

    return resultados;
  }

  @Get('diagnostico/tabla-origen')
  async diagnosticarTablaOrigen() {
    return this.reporteService.probarTablaOrigen();
  }
}
