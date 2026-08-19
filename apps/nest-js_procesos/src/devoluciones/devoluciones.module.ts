import { Module } from '@nestjs/common';
import { DevolucionesController } from './devoluciones.controller';
import { DevolucionesService } from './devoluciones.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DevolucionesController],
  providers: [DevolucionesService],
})
export class DevolucionesModule {}
