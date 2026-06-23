import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CccOneController } from './ccc-one.controller';
import { CccOneService } from './ccc-one.service';
import { EmailImapService } from './services/email-imap.service';
import { CccOnePlaywrightService } from './services/ccc-one-playwright.service';
import { CccOneStorageService } from './services/ccc-one-storage.service';
import { CccOneZipService } from './services/ccc-one-zip.service';
import { CccOneEmailService } from './services/ccc-one-email.service';
import {
  BbvaCanalStrategy,
  AttCanalStrategy,
  GmfCanalStrategy,
  TytCanalStrategy,
  ScotCanalStrategy,
} from './strategies';
import { ReportLoggerService } from '../generador_reporte_ivr_reminder/services/logger.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CccOneController],
  providers: [
    CccOneService,
    EmailImapService,
    CccOnePlaywrightService,
    CccOneStorageService,
    CccOneZipService,
    CccOneEmailService,
    BbvaCanalStrategy,
    AttCanalStrategy,
    GmfCanalStrategy,
    TytCanalStrategy,
    ScotCanalStrategy,
    ReportLoggerService,
  ],
  exports: [CccOneService],
})
export class CccOneModule {}
