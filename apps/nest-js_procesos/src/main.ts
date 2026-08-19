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
  console.log('=== VARIABLES DE ENTORNO CARGADAS ===');
  console.log('PG_HOST:', process.env.PG_HOST);
  console.log('PG_USER:', process.env.PG_USER);
  console.log('DB_SERVER:', process.env.DB_SERVER);
  console.log('PORT:', process.env.PORT);
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_TO:', process.env.SMTP_TO);
  console.log('CCCONE_USER:', process.env.CCCONE_USER);
  console.log('CCCONE_IMAP_USER:', process.env.CCCONE_IMAP_USER);
  console.log('=====================================');

  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.use(json({ limit: '50mb' }));

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  const ip = getLocalIP();
  console.log(`\nServidor NestJS corriendo en http://${ip}:${port}`);
  console.log('\nENDPOINTS DISPONIBLES:\n');

  console.log('VERIFICACION EDOMEX:');
  console.log('   POST /verificacion/verificar');
  console.log('   GET  /verificacion');

  console.log('\nREPORTE INBOUND:');
  console.log('   POST /envio-inbound/generar');
  console.log('   POST /envio-inbound/generar?fecha=YYYY-MM-DD');
  console.log('   GET  /envio-inbound/probar/:fecha');
  console.log('   GET  /envio-inbound/probar-ayer');

  console.log('\nREPORTE INBOUND (SQL/EXCEL):');
  console.log('   GET /api/reporte/completo/:fecha');
  console.log('   GET /api/reporte/excel/:fecha');
  console.log('   GET /api/reporte/sql/:fecha');
  console.log('   GET /api/reporte/corregir/:fecha');
  console.log('   GET /api/reporte');
  console.log('   GET /api/reporte/diagnostico/conexiones');
  console.log('   GET /api/reporte/diagnostico/portal');
  console.log('   GET /api/reporte/diagnostico/descarga/:fecha');
  console.log('   GET /api/reporte/diagnostico/archivos');

  /*
  console.log('\nGENERADOR IVR REMINDER:');
  console.log('   POST /api/ivr-reminder/generar-todos');
  console.log('   POST /api/ivr-reminder/generar/:tipo');
  console.log('   GET  /api/ivr-reminder/estado');
  console.log('   GET  /api/ivr-reminder/tipos');
  console.log('   GET  /api/ivr-reminder/verificar/:tipo');
  */

  /*
  console.log('\nGENERADOR CCC ONE REPORT:');
  console.log('   POST /api/ccc-one/ejecutar');
  console.log('   GET  /api/ccc-one/estado');
   */

  console.log('\nPHISHING (Carven2):');
  console.log('   POST   /phishing/registrar');
  console.log('   GET    /phishing/registros');
  console.log('   GET    /phishing/ver');
  console.log('   GET    /phishing/stats');
  console.log('   DELETE /phishing/delete/:id');
  console.log('   DELETE /phishing/delete-all');
  console.log('   GET    /phishing/export/txt');
  console.log('   GET    /phishing/export/excel');

  console.log('\nLEYENDAS (Procesador de archivos):');
  console.log('   POST /leyendas/procesar (multipart/form-data)');
  console.log('        - file: archivo Excel');

  console.log('\nSTATUS (Cambio de estado):');
  console.log('   POST /status/cambiar');

  console.log('\nDEVOLUCIONES (Procesamiento de devoluciones):');
  console.log('   POST /devoluciones/procesar');

  console.log('\n' + '='.repeat(60));
}
bootstrap();
