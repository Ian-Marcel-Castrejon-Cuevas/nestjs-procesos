import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import { ReportLoggerService } from '../../generador_reporte_ivr_reminder/services/logger.service';
import {
  Canal,
  CONFIG_CANALES_EMAIL,
  CCC_ONE_CONFIG,
  CCCONE_EMAIL_FROM,
} from '../constants/ccc-one.constants';

interface EmailAttachment {
  filename: string;
  path: string;
}

@Injectable()
/**
 * Servicio responsable de envío de correos específicos para CCC One.
 */
export class CccOneEmailService {
  private transporter: nodemailer.Transporter;

  constructor(private logger: ReportLoggerService) {
    this.transporter = nodemailer.createTransport({
      host: CCC_ONE_CONFIG.SMTP_SERVER,
      port: CCC_ONE_CONFIG.SMTP_PORT,
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  async enviarCorreo(canal: Canal, archivos?: string[]): Promise<boolean> {
    this.logger.info('Iniciando envío de correo');

    try {
      const config = CONFIG_CANALES_EMAIL[canal];
      if (!config) {
        this.logger.error(` Código no válido: ${canal}`);
        return false;
      }

      if (!config.destinatarios || config.destinatarios.length === 0) {
        this.logger.warn(
          ` No hay destinatarios configurados para el canal ${canal}`,
        );
        return false;
      }

      const fechaAyer = new Date();
      fechaAyer.setDate(fechaAyer.getDate() - 1);
      const fechaAyerStr = fechaAyer
        .toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        .replace(/\//g, '');

      const subject = `Envío Reporte IVR CCCOne ${config.canal}-${canal} ${fechaAyerStr}`;

      let html = `<p>Se depositó el reporte IVR CCCOne de la campaña ${config.canal} del canal ${canal} correspondiente al día ${fechaAyerStr}.</p>`;

      const attachments: EmailAttachment[] = [];
      if (config.canal === 'SCOT' && archivos && archivos.length > 0) {
        for (const archivo of archivos) {
          if (fs.existsSync(archivo)) {
            attachments.push({
              filename: path.basename(archivo),
              path: archivo,
            });
          } else {
            this.logger.warn(` Archivo adjunto no encontrado: ${archivo}`);
          }
        }
        if (attachments.length > 0) {
          html += '<p>Se adjunta archivo ZIP protegido con contraseña.</p>';
        }
      }

      const mailOptions = {
        from: CCCONE_EMAIL_FROM,
        to: config.destinatarios.join(', '),
        subject,
        html,
        attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.info(
        ` Correo enviado correctamente para canal ${config.canal} - ${canal}`,
      );
      this.logger.debug(` ID del mensaje: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(
        ` Error enviando correo para canal ${canal}: ${error.message}`,
      );
      return false;
    }
  }
}
