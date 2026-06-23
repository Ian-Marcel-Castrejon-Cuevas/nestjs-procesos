import { Module } from '@nestjs/common';
import { ReporteController } from './reporte.controller';
import { ReporteService } from './reporte.service';

@Module({
  controllers: [ReporteController],
  providers: [ReporteService],
})
export class ReporteModule {}
