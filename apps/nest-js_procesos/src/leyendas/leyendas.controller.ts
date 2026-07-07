import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { LeyendasService } from './leyendas.service';
import { ProcesarArchivoDto } from './dto/procesar-archivo.dto';

@Controller('leyendas')
export class LeyendasController {
  constructor(private readonly leyendasService: LeyendasService) {}

  @Post('procesar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  async procesarArchivo(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ProcesarArchivoDto,
    @Res() res: Response,
  ) {
    try {
      if (!file) {
        throw new HttpException(
          'No se recibió ningún archivo',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.banco) {
        throw new HttpException(
          'Banco no especificado',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.tipo) {
        throw new HttpException(
          'Tipo de archivo no especificado (LEYENDAS o GESTIONES)',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.fecha || body.fecha.length !== 6) {
        throw new HttpException(
          'Fecha no válida. Use formato DDMMYY',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.columnas || body.columnas.length === 0) {
        throw new HttpException(
          'Debes seleccionar al menos una columna',
          HttpStatus.BAD_REQUEST,
        );
      }

      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        throw new HttpException(
          'Formato de archivo no soportado. Use .xlsx o .xls',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.leyendasService.procesarArchivo(
        file.buffer,
        body.banco,
        body.tipo,
        body.fecha,
        body.columnas,
        body.tipoGMF,
        file.originalname,
      );

      if (result.archivos.length === 1) {
        res.download(result.archivos[0], result.nombres[0], async (err) => {
          if (err) {
            console.error('Error al enviar archivo:', err);
          }
          await this.leyendasService.limpiarArchivosTemporales(result.tempDir);
        });
      } else {
        res.json({
          multipleFiles: true,
          sessionId: result.sessionId,
          files: result.archivos.map((archivoPath, idx) => ({
            name: result.nombres[idx],
            downloadUrl: `/leyendas/download/${result.sessionId}/${idx}`,
            size: result.tamanos[idx],
            registros: result.registrosPorArchivo[idx],
          })),
          totalArchivos: result.archivos.length,
          totalRegistros: result.totalRegistros,
          message:
            'Se generaron múltiples archivos. Por favor, descárgalos individualmente.',
        });
      }
    } catch (error) {
      console.error('Error en procesarArchivo:', error);
      throw new HttpException(
        { error: error.message },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download/:sessionId/:fileIndex')
  async downloadFile(
    @Param('sessionId') sessionId: string,
    @Param('fileIndex') fileIndex: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.leyendasService.getArchivoPorSession(
        sessionId,
        parseInt(fileIndex),
      );

      res.download(result.filePath, result.fileName, async (err) => {
        if (err) {
          console.error('Error al enviar archivo:', err);
        }
      });
    } catch (error) {
      throw new HttpException({ error: error.message }, HttpStatus.NOT_FOUND);
    }
  }

  @Get('session/:sessionId')
  async getSessionInfo(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ) {
    try {
      const info = await this.leyendasService.getSessionInfo(sessionId);
      res.json(info);
    } catch (error) {
      throw new HttpException({ error: error.message }, HttpStatus.NOT_FOUND);
    }
  }
}
