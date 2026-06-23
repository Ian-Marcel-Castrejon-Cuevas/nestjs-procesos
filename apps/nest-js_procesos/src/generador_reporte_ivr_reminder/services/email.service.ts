import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ReportLoggerService } from './logger.service';
import { DateUtils } from '../utils/date.utils';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private logger: ReportLoggerService) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;

    if (!smtpHost || !smtpPort) {
      this.logger.warn('SMTP configuration missing, email service disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: false,
      tls: { rejectUnauthorized: false },
    });
  }

  async sendReportEmail(reportType: string, filePath: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email service not configured, skipping email');
      return;
    }

    const yesterday = DateUtils.getYesterday();
    const dateStr = DateUtils.formatDateToDisplay(yesterday);

    const subject = `Envío Reporte IVR ${reportType} - ${dateStr}`;
    const recipients = process.env.SMTP_TO?.split(',') || [];

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { padding: 20px; background-color: #f4f4f4; }
          .header { background-color: #0056b3; color: white; padding: 10px; }
          .content { margin: 20px 0; }
          .success { color: green; font-weight: bold; }
          .info { background-color: #e9ecef; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Reporte Automático IVR Reminder</h2>
          </div>
          <div class="content">
            <p>El reporte <strong>${reportType}</strong> ha sido generado exitosamente.</p>
            <div class="info">
              <p><strong>Fecha:</strong> ${dateStr}</p>
              <p><strong>Ruta:</strong> ${filePath}</p>
              <p><strong>Hora generación:</strong> ${new Date().toLocaleTimeString()}</p>
            </div>
            <p class="success">El archivo ha sido depositado en la carpeta de red correspondiente.</p>
          </div>
          <hr>
          <small>Este es un mensaje automático, por favor no responder.</small>
        </div>
      </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients.join(', '),
      subject,
      html,
      text: `Reporte IVR ${reportType} del día ${dateStr}\n\nRuta: ${filePath}`,
    });

    this.logger.info(`Correo enviado para reporte ${reportType}`);
  }

  async sendSummary(results: any[]): Promise<void> {
    if (!this.transporter) return;

    const successCount = results.filter((r) => r.success).length;
    const total = results.length;

    const html = `
      <h2>Resumen de generación de reportes</h2>
      <p>Completados: ${successCount}/${total}</p>
      <ul>
        ${results.map((r) => `<li>${r.type}: ${r.success ? ' Éxito' : ' Fallo'} ${r.error ? `- ${r.error}` : ''}</li>`).join('')}
      </ul>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_TO,
      subject: ' Resumen Automatización IVR Reminder',
      html,
    });
  }
}
