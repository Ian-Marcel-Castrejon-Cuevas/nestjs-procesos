import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule'; // ← AGREGAR ESTO
import { GeneradorController } from './generador.controller';
import { GeneradorService } from './generador.service';
import { EmailService } from './services/email.service';
import { ReportLoggerService } from './services/logger.service';
import { PlaywrightService } from './services/playwright.service';
import { StorageService } from './services/storage.service';
import { AttStrategy } from './strategies/att.strategy';
import { BbvaVigStrategy } from './strategies/bbva-vig.strategy';
import { BbvaStrategy } from './strategies/bbva.strategy';
import { GMFStrategy } from './strategies/gmf.strategy';

@Module({
  imports: [
    ScheduleModule.forRoot(),
  ],
  controllers: [GeneradorController],
  providers: [
    GeneradorService,
    PlaywrightService,
    StorageService,
    EmailService,
    ReportLoggerService,
    BbvaStrategy,
    BbvaVigStrategy,
    AttStrategy,
    GMFStrategy,
  ],
  exports: [GeneradorService],
})
/**
 * Módulo que agrupa los componentes del generador de reportes IVR.
 */
export class GeneradorModule {}