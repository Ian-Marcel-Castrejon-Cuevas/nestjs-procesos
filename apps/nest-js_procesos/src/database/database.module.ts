import { Module } from '@nestjs/common';
import { Pool } from 'pg';

require('dotenv').config();

const pgHost = process.env.PG_HOST;
const pgPort = process.env.PG_PORT;
const pgUser = process.env.PG_USER;
const pgPassword = process.env.PG_PASSWORD;
const pgDatabase = process.env.PG_DATABASE;

if (
  process.env.DEMO_MODE !== 'true' &&
  (!pgHost || !pgPort || !pgUser || !pgPassword || !pgDatabase)
) {
  throw new Error(
    'Faltan variables de entorno para PostgreSQL. Usa DEMO_MODE=true solo para una demostración sin conexiones.',
  );
}

/**
 * Pool de conexión a PostgreSQL compartido (exportado).
 * Proporcionado a través del token `PG_POOL` para inyección.
 */
export const pgPool =
  pgHost && pgPort && pgUser && pgPassword && pgDatabase
    ? new Pool({
        host: pgHost,
        port: parseInt(pgPort, 10),
        user: pgUser,
        password: pgPassword,
        database: pgDatabase,
      })
    : null;

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
