import { Module } from '@nestjs/common';
import { Pool } from 'pg';

require('dotenv').config();

console.log('=== DEBUG DATABASE MODULE ===');
console.log('PG_HOST:', process.env.PG_HOST);
console.log('PG_USER:', process.env.PG_USER);
console.log('PG_DATABASE:', process.env.PG_DATABASE);
console.log('=============================');

const pgHost = process.env.PG_HOST;
const pgPort = process.env.PG_PORT;
const pgUser = process.env.PG_USER;
const pgPassword = process.env.PG_PASSWORD;
const pgDatabase = process.env.PG_DATABASE;

if (!pgHost || !pgPort || !pgUser || !pgPassword || !pgDatabase) {
  console.error('ERROR: Faltan variables de entorno para PostgreSQL');
  console.error('PG_HOST:', pgHost);
  console.error('PG_PORT:', pgPort);
  console.error('PG_USER:', pgUser);
  console.error('PG_PASSWORD:', pgPassword ? '***' : 'undefined');
  console.error('PG_DATABASE:', pgDatabase);
  throw new Error('Faltan variables de entorno para PostgreSQL');
}

/**
 * Pool de conexión a PostgreSQL compartido (exportado).
 * Proporcionado a través del token `PG_POOL` para inyección.
 */
export const pgPool = new Pool({
  host: pgHost,
  port: parseInt(pgPort, 10),
  user: pgUser,
  password: pgPassword,
  database: pgDatabase,
});

/**
 * Módulo de base de datos que expone `PG_POOL` para inyección.
 * Verifica variables de entorno y crea el pool al iniciar.
 */
@Module({
  providers: [
    {
      provide: 'PG_POOL',
      useValue: pgPool,
    },
  ],
  exports: ['PG_POOL'],
})
export class DatabaseModule {}
