import { Controller, Post, Body } from '@nestjs/common';
import { StatusService } from './status.service';
import { CambiarStatusDto } from './dto/cambiar-status.dto';

@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Post('cambiar')
  async cambiarStatus(@Body() cambiarStatusDto: CambiarStatusDto) {
    return this.statusService.cambiarStatus(
      cambiarStatusDto.status,
      cambiarStatusDto.claves,
    );
  }
}
