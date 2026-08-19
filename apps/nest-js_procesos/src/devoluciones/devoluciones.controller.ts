import { Controller, Post, Body } from '@nestjs/common';
import { DevolucionesService } from './devoluciones.service';
import { ProcesarDevolucionDto } from './dto/procesar-devolucion.dto';

@Controller('devoluciones')
export class DevolucionesController {
  constructor(private readonly devolucionesService: DevolucionesService) {}

  @Post('procesar')
  async procesarDevoluciones(@Body() body: ProcesarDevolucionDto) {
    return this.devolucionesService.procesarDevoluciones(
      body.tipo,
      body.registros,
    );
  }
}
