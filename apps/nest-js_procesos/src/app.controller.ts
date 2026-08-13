import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
/**
 * Controlador principal de la aplicación.
 * Provee endpoints básicos de salud y enrutamiento de prueba.
 */
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
