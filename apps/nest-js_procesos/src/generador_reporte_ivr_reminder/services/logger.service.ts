import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
/**
 * Servicio de logging centralizado para reportes (envoltorio con niveles y formato).
 */
export class ReportLoggerService {
  private logger: winston.Logger;

  constructor() {
    const logDir = 'Logs_Automatizacion';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(
      logDir,
      `Automatizacion_IVR_Reminder_${today}.log`,
    );

    this.cleanOldLogs(logDir, 7);

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context }) => {
          return `${timestamp} | ${level.toUpperCase()} | ${context || 'Automatizacion'} | ${message}`;
        }),
      ),
      transports: [
        new winston.transports.File({ filename: logFile }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      ],
    });
  }

  private cleanOldLogs(logDir: string, daysToKeep: number) {
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    if (fs.existsSync(logDir)) {
      fs.readdirSync(logDir).forEach((file) => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      });
    }
  }

  info(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(`${message} ${trace || ''}`, { context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }
}
