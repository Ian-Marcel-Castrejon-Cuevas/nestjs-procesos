import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface RegistroPhishing {
  id: number;
  ch: string;
  ipAddress: string;
  userAgent: string;
  pagina: string;
  fechaHora: string;
  tipo: string;
}

@Injectable()
/**
 * Servicio para gestionar registros de phishing en disco.
 * Provee operaciones CRUD, exportación y estadísticas locales.
 */
export class PhishingService {
  private filePath: string;
  private registros: RegistroPhishing[] = [];
  private currentId = 1;

  /**
   * Constructor.
   * Inicializa la ruta del archivo local y carga registros existentes desde disco.
   */
  constructor() {
    this.filePath = path.join(process.cwd(), 'phishing_registros.json');
    this.cargarDatos();
  }

  private cargarDatos() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        this.registros = parsed.registros || [];
        this.currentId = parsed.currentId || 1;
      } else {
        this.registros = [];
        this.currentId = 1;
        this.guardarDatos();
      }
    } catch (error) {
      console.error('Error cargando JSON:', error);
      this.registros = [];
      this.currentId = 1;
    }
  }

  private guardarDatos() {
    try {
      const data = {
        registros: this.registros,
        currentId: this.currentId,
        ultimaActualizacion: new Date().toISOString(),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error guardando JSON:', error);
    }
  }

  async registrar(data: any, ipAddress: string): Promise<RegistroPhishing> {
    const nuevoRegistro: RegistroPhishing = {
      id: this.currentId++,
      ch: data.ch,
      ipAddress: ipAddress,
      userAgent: data.user_agent || '',
      pagina: data.pagina || '',
      fechaHora: data.timestamp || new Date().toISOString(),
      tipo: data.tipo || 'intento',
    };

    this.registros.unshift(nuevoRegistro);
    this.guardarDatos();

    return nuevoRegistro;
  }

  async findAll(): Promise<RegistroPhishing[]> {
    return this.registros;
  }

  async delete(id: number): Promise<boolean> {
    const index = this.registros.findIndex((r) => r.id === id);
    if (index === -1) {
      return false;
    }
    this.registros.splice(index, 1);
    this.guardarDatos();
    return true;
  }

  async deleteAll(): Promise<number> {
    const count = this.registros.length;
    this.registros = [];
    this.currentId = 1;
    this.guardarDatos();
    return count;
  }

  async getStats() {
    const total = this.registros.length;
    const hoy = new Date().toISOString().split('T')[0];

    const hoyRegistros = this.registros.filter((r) => {
      const fechaRegistro = new Date(r.fechaHora).toISOString().split('T')[0];
      return fechaRegistro === hoy;
    }).length;

    const intentos = this.registros.filter((r) => r.tipo === 'intento').length;
    const visitas = this.registros.filter((r) => r.tipo === 'visita').length;

    return { total, hoyRegistros, intentos, visitas };
  }

  async exportToTXT(): Promise<string> {
    let contenido = '=== REGISTROS DE ACTIVIDAD PHISHING ===\n';
    contenido += `Fecha de exportación: ${new Date().toLocaleString()}\n`;
    contenido += '='.repeat(60) + '\n\n';

    for (const reg of this.registros) {
      contenido += `ID: ${reg.id}\n`;
      contenido += `CH: ${reg.ch}\n`;
      contenido += `IP: ${reg.ipAddress}\n`;
      contenido += `User Agent: ${reg.userAgent || 'N/A'}\n`;
      contenido += `Página: ${reg.pagina || 'N/A'}\n`;
      contenido += `Fecha/Hora: ${reg.fechaHora}\n`;
      contenido += `Tipo: ${reg.tipo}\n`;
      contenido += '-'.repeat(40) + '\n\n';
    }

    return contenido;
  }

  async exportToCSV(): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const csvPath = path.join(tempDir, `phishing_registros_${Date.now()}.csv`);
    const headers = ['ID,CH,IP Address,User Agent,Página,Fecha/Hora,Tipo\n'];
    const rows = this.registros.map(
      (reg) =>
        `${reg.id},"${reg.ch}","${reg.ipAddress}","${(reg.userAgent || '').replace(/"/g, '""')}","${reg.pagina || ''}","${reg.fechaHora}","${reg.tipo}"`,
    );

    const csvContent = headers.concat(rows).join('\n');
    fs.writeFileSync(csvPath, csvContent, 'utf-8');

    return csvPath;
  }

  getRawJson() {
    return {
      registros: this.registros,
      total: this.registros.length,
      ultimaActualizacion: new Date().toISOString(),
    };
  }

  getJsonFilePath(): string {
    return this.filePath;
  }
}
