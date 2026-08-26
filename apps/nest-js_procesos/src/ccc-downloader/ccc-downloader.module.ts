import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CccDownloaderController } from './ccc-downloader.controller';
import { CccDownloaderService } from './ccc-downloader.service';
import { SeleniumHelper } from './utils/selenium-helper';
import { CsvProcessor } from './utils/csv-processor';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CccDownloaderController],
  providers: [CccDownloaderService, SeleniumHelper, CsvProcessor],
  exports: [CccDownloaderService],
})
export class CccDownloaderModule {}
