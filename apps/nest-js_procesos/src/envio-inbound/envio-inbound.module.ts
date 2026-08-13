import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlamadaInbound } from './entities/llamada-inbound.entity';
import { EnvioInboundController } from './envio-inbound.controller';
import { EnvioInboundService } from './envio-inbound.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LlamadaInbound]),
    ScheduleModule.forRoot(),
  ],
  controllers: [EnvioInboundController],
  providers: [EnvioInboundService],
  exports: [EnvioInboundService],
})
export class EnvioInboundModule {}
/**
 * Módulo que encapsula la lógica de generación y envío de reportes Inbound.
 */