import { Module } from '@nestjs/common';
import { VerificacionController } from './verificacion.controller';
import { VerificacionService } from './verificacion.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [VerificacionController],
  providers: [VerificacionService],
})
export class VerificacionModule {}
