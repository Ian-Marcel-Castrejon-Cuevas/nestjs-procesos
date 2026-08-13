import { Injectable } from '@nestjs/common';

@Injectable()
/**
 * Servicio principal de la aplicación que expone utilidades simples.
 * Actualmente implementa `getHello()` para pruebas de salud.
 */
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
