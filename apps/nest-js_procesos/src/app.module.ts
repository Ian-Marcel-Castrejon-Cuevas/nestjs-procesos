import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlamadaInbound } from './envio-inbound/entities/llamada-inbound.entity';
import { EnvioInboundModule } from './envio-inbound/envio-inbound.module';
//import { GeneradorModule } from './generador_reporte_ivr_reminder/generador.module';
import { ReporteModule } from './reporte/reporte.module';
import { VerificacionModule } from './verificacion/verificacion.module';
//import { CccOneModule } from './ccc-one/ccc-one.module';
import { PhishingModule } from './phishing/phishing.module';
import { LeyendasModule } from './leyendas/leyendas.module';

// 🔍 DEBUG - Ver qué variables existen
console.log('=== DEBUG DE VARIABLES DE ENTORNO ===');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_SERVER:', process.env.DB_SERVER);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_PASSWORD existe?', process.env.DB_PASSWORD ? 'SÍ' : 'NO');
console.log('Todas las variables DB_*:');
Object.keys(process.env)
  .filter((k) => k.startsWith('DB_'))
  .forEach((k) => {
    console.log(`  ${k}=${process.env[k]}`);
  });
console.log('=====================================');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Especifica explícitamente el archivo
    }),
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_SERVER,
      port: parseInt(process.env.DB_PORT || '1433'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [LlamadaInbound],
      synchronize: false,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      extra: {
        connectionTimeout: 30000,
        requestTimeout: 30000,
      },
    }),
    VerificacionModule,
    ReporteModule,
    //GeneradorModule,
    EnvioInboundModule,
    //CccOneModule,
    PhishingModule,
    LeyendasModule,
  ],
})
export class AppModule {}
