import { Controller, Post, Body, Get, Delete } from '@nestjs/common';
import { VerificacionService } from './verificacion.service';
import { VerificarDto } from './dto/verificar.dto';

@Controller('verificacion')
export class VerificacionController {
  constructor(private readonly verificacionService: VerificacionService) {}

  @Post('verificar')
  async verificar(@Body() verificarDto: VerificarDto) {
    return this.verificacionService.verificarClaves(verificarDto.claves);
  }

  @Delete('borrar-ingresos')
  async borrarIngresos() {
    return this.verificacionService.borrarIngresosAntiguos();
  }

  @Get()
  getStatus() {
    return { mensaje: 'Servidor backend activo' };
  }
}