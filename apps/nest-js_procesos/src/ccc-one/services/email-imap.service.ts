import { Injectable } from '@nestjs/common';
import * as imaps from 'imap-simple';
import { ReportLoggerService } from '../../generador_reporte_ivr_reminder/services/logger.service';
import { CorreoResultado } from '../interfaces/ccc-one.interface';
import {
  ASUNTO_CORREO_OBJETIVO,
  TIMEOUT_CORREO_SEGUNDOS,
  INTERVALO_CORREO_SEGUNDOS,
  CCC_ONE_CONFIG,
  CCCONE_IMAP_CREDENTIALS,
} from '../constants/ccc-one.constants';

@Injectable()
export class EmailImapService {
  constructor(private logger: ReportLoggerService) {}

  async obtenerLinkReporte(): Promise<CorreoResultado> {
    this.logger.info('Esperando correo del reporte de Historial de Llamadas');

    if (!CCCONE_IMAP_CREDENTIALS.USER || !CCCONE_IMAP_CREDENTIALS.PASSWORD) {
      this.logger.error(' Faltan credenciales IMAP en variables de entorno');
      return { status: 'TIMEOUT' };
    }

    const inicio = Date.now();

    while (Date.now() - inicio < TIMEOUT_CORREO_SEGUNDOS * 1000) {
      let connection: any = null;
      try {
        const config = {
          imap: {
            user: CCCONE_IMAP_CREDENTIALS.USER,
            password: CCCONE_IMAP_CREDENTIALS.PASSWORD,
            host: CCC_ONE_CONFIG.IMAP_SERVER,
            port: CCC_ONE_CONFIG.IMAP_PORT,
            tls: false, // ← Cambiado a false para GroupWise
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 30000,
            connTimeout: 30000,
          },
        };

        connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: true };

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (!messages || messages.length === 0) {
          this.logger.debug('No hay correos nuevos. Continuando...');
          if (connection) await connection.end();
          await this.sleep(INTERVALO_CORREO_SEGUNDOS * 1000);
          continue;
        }

        const correosABorrar: string[] = [];
        let resultadoFinal: CorreoResultado | null = null;

        for (const msg of messages) {
          try {
            const header = msg.parts.find(
              (part: any) => part.which === 'HEADER',
            );
            const subject = header?.body.subject?.[0] || '';

            if (
              subject
                .toLowerCase()
                .includes(ASUNTO_CORREO_OBJETIVO.toLowerCase())
            ) {
              const textPart = msg.parts.find(
                (part: any) => part.which === 'TEXT',
              );
              const cuerpo = textPart?.body || '';

              const registrosMatch = cuerpo.match(
                /Registros de Llamada:\s*(\d+)/,
              );
              const registros = registrosMatch
                ? parseInt(registrosMatch[1])
                : 0;

              this.logger.info(` Correo encontrado - Registros: ${registros}`);

              correosABorrar.push(msg.attributes.uid.toString());

              const linkMatch = cuerpo.match(/https?:\/\/[^\s"'>]+/);
              if (!linkMatch) {
                this.logger.warn('Correo encontrado pero sin link de descarga');
                resultadoFinal = {
                  status: 'SIN_LINK',
                  link: undefined,
                  correoId: msg.attributes.uid.toString(),
                };
                continue;
              }

              this.logger.info(` Link de descarga encontrado: ${linkMatch[0]}`);
              resultadoFinal = {
                status: 'OK',
                link: linkMatch[0],
                correoId: msg.attributes.uid.toString(),
              };
              break;
            }
          } catch (msgError) {
            this.logger.warn(`Error procesando correo: ${msgError.message}`);
            continue;
          }
        }

        if (correosABorrar.length > 0 && connection) {
          for (const uid of correosABorrar) {
            try {
              await connection.addFlags(uid, '\\Deleted');
            } catch (flagError) {
              this.logger.warn(
                `Error marcando correo ${uid} como eliminado: ${flagError.message}`,
              );
            }
          }
          await connection.expunge();
          this.logger.info(
            ` Se eliminaron ${correosABorrar.length} correos procesados.`,
          );
        }

        if (connection) await connection.end();

        if (resultadoFinal && resultadoFinal.link) {
          return resultadoFinal;
        }
      } catch (error) {
        this.logger.error(`Error en conexión IMAP: ${error.message}`);
        if (connection) {
          try {
            await connection.end();
          } catch (e) {}
        }
      }

      await this.sleep(INTERVALO_CORREO_SEGUNDOS * 1000);
    }

    this.logger.error(' No llegó el correo del reporte en el tiempo esperado');
    return { status: 'TIMEOUT' };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
