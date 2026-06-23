import { Module } from '@nestjs/common';
import { LeyendasController } from './leyendas.controller';
import { LeyendasService } from './leyendas.service';

@Module({
  controllers: [LeyendasController],
  providers: [LeyendasService],
})
export class LeyendasModule {}
