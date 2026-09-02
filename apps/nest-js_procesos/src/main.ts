require('dotenv').config({ path: './.env' });

import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import * as os from 'os';
import { AppModule } from './app.module';

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (ifaceList) {
      for (const iface of ifaceList) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }
  return 'localhost';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.use(json({ limit: '50mb' }));

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  const ip = getLocalIP();
  console.log(`\n🚀 Servidor NestJS corriendo en http://${ip}:${port}`);
  console.log('\n📋 ENDPOINTS DISPONIBLES:\n');

  console.log('📌 VERIFICACION EDOMEX:');
  console.log('   POST /verificacion/verificar');
  console.log('   GET  /verificacion');

  console.log('\n📌 REPORTE INBOUND:');
  console.log('   POST /envio-inbound/generar');
  console.log('   POST /envio-inbound/generar?fecha=YYYY-MM-DD');
  console.log('   GET  /envio-inbound/probar/:fecha');
  console.log('   GET  /envio-inbound/probar-ayer');

  console.log('\n📌 REPORTE INBOUND (SQL/EXCEL):');
  console.log('   GET /api/reporte/completo/:fecha');
  console.log('   GET /api/reporte/excel/:fecha');
  console.log('   GET /api/reporte/sql/:fecha');
  console.log('   GET /api/reporte/corregir/:fecha');
  console.log('   GET /api/reporte');
  console.log('   GET /api/reporte/diagnostico/conexiones');
  console.log('   GET /api/reporte/diagnostico/portal');
  console.log('   GET /api/reporte/diagnostico/descarga/:fecha');
  console.log('   GET /api/reporte/diagnostico/archivos');

  console.log('\n📌 CCC DOWNLOADER (Historial de llamadas):');
  console.log('   POST /ccc-downloader/ejecutar');
  console.log(
    '   POST /ccc-downloader/ejecutar  Body: { "fecha": "YYYY-MM-DD" }',
  );
  console.log('   POST /ccc-downloader/cuenta');
  console.log(
    '   POST /ccc-downloader/cuenta    Body: { "customerId": "2625", "fecha": "YYYY-MM-DD" }',
  );
  console.log('   GET  /ccc-downloader/cuentas');
  console.log('   GET  /ccc-downloader/fecha-ayer');
  console.log(
    '   ⏰ CRON: Se ejecuta automáticamente a las 2:00 AM (hora CDMX)',
  );

  console.log('\n📌 PHISHING (Carven2):');
  console.log('   POST   /phishing/registrar');
  console.log('   GET    /phishing/registros');
  console.log('   GET    /phishing/ver');
  console.log('   GET    /phishing/stats');
  console.log('   DELETE /phishing/delete/:id');
  console.log('   DELETE /phishing/delete-all');
  console.log('   GET    /phishing/export/txt');
  console.log('   GET    /phishing/export/excel');

  console.log('\n📌 LEYENDAS (Procesador de archivos):');
  console.log('   POST /leyendas/procesar (multipart/form-data)');
  console.log('        - file: archivo Excel');

  console.log('\n📌 STATUS (Cambio de estado):');
  console.log('   POST /status/cambiar');

  console.log('\n📌 DEVOLUCIONES (Procesamiento de devoluciones):');
  console.log('   POST /devoluciones/procesar');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Servidor listo para recibir peticiones');
  console.log('='.repeat(60));
}
bootstrap();
