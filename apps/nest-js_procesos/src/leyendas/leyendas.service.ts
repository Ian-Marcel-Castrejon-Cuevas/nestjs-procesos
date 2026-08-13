import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
/**
 * Servicio para procesar archivos de leyendas: segmentación en chunks,
 * generación de Excel y gestión de sesiones temporales.
 */
export class LeyendasService {
  private readonly CHUNK_SIZE = 64999;
  private sessions: Map<
    string,
    {
      archivos: string[];
      nombres: string[];
      tempDir: string;
      timestamp: number;
      registrosPorArchivo: number[];
      totalRegistros: number;
    }
  > = new Map();

  async procesarArchivo(
    fileBuffer: Buffer,
    banco: string,
    tipoArchivo: string,
    fecha: string,
    columnasSeleccionadas: string[],
    tipoGMF?: string,
    originalFilename?: string,
  ): Promise<{
    archivos: string[];
    nombres: string[];
    tamanos: number[];
    sessionId: string;
    tempDir: string;
    registrosPorArchivo: number[];
    totalRegistros: number;
  }> {
    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellFormula: false,
        cellHTML: false,
        cellNF: false,
        sheetStubs: false,
      });
    } catch (error) {
      throw new Error('El archivo no es un Excel valido o esta corrupto');
    }

    const nombreHoja = workbook.SheetNames[0];
    const hojaOriginal = workbook.Sheets[nombreHoja];

    const jsonData = XLSX.utils.sheet_to_json(hojaOriginal, {
      header: 1,
      defval: '',
      blankrows: true,
    });

    const datosLimpios = this.limpiarDatos(jsonData as any[][]);

    if (!datosLimpios || datosLimpios.length === 0) {
      throw new Error('El archivo esta vacio o corrupto');
    }

    const encabezadosOriginales = datosLimpios[0];

    const indicesColumnas: number[] = [];
    const nuevosEncabezados: string[] = [];

    for (const columnaSeleccionada of columnasSeleccionadas) {
      const index = encabezadosOriginales.findIndex(
        (h) =>
          h &&
          h.toString().toLowerCase().trim() ===
            columnaSeleccionada.toLowerCase().trim(),
      );
      if (index !== -1) {
        indicesColumnas.push(index);
        nuevosEncabezados.push(encabezadosOriginales[index]);
      } else {
        let encontrado = false;
        for (let i = 0; i < encabezadosOriginales.length; i++) {
          const header =
            encabezadosOriginales[i]?.toString().toLowerCase().trim() || '';
          if (header.includes(columnaSeleccionada.toLowerCase().trim())) {
            indicesColumnas.push(i);
            nuevosEncabezados.push(encabezadosOriginales[i]);
            encontrado = true;
            break;
          }
        }
        if (!encontrado) {
          indicesColumnas.push(-1);
          nuevosEncabezados.push(columnaSeleccionada);
        }
      }
    }

    let filasData = datosLimpios.slice(1);

    let filasProcesadas = this.procesarFilas(
      filasData,
      indicesColumnas,
      nuevosEncabezados,
    );

    const chunks: any[][][] = [];
    for (let i = 0; i < filasProcesadas.length; i += this.CHUNK_SIZE) {
      const chunk = filasProcesadas.slice(i, i + this.CHUNK_SIZE);
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    const registrosPorArchivo: number[] = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      registrosPorArchivo.push(chunks[idx].length);
    }

    const sessionId = `${banco}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempDir = path.join(process.cwd(), 'temp', sessionId);
    fs.mkdirSync(tempDir, { recursive: true });

    const archivosGenerados: string[] = [];
    const nombresGenerados: string[] = [];
    const tamanosGenerados: number[] = [];

    let prefijo = tipoArchivo === 'LEYENDAS' ? 'LEY' : 'GEST';
    let cartera = this.obtenerNombreBanco(banco);
    let extra = '';

    if (banco === 'GMF' && tipoGMF) {
      extra = `_${tipoGMF}`;
    }

    const nombreBase = `${prefijo}_${cartera}${extra}_${fecha}`;

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const matrizFinal = [nuevosEncabezados, ...chunk];

      const newWorkbook = XLSX.utils.book_new();
      const newSheet = XLSX.utils.aoa_to_sheet(matrizFinal, {
        cellDates: false,
      });

      const ultimaFilaConDatos = matrizFinal.length - 1;
      const ultimaColumna = nuevosEncabezados.length - 1;

      const rangoExacto = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: ultimaFilaConDatos, c: ultimaColumna },
      });
      newSheet['!ref'] = rangoExacto;

      delete newSheet['!merges'];
      delete newSheet['!cols'];
      delete newSheet['!rows'];

      XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Hoja1');

      let fileName: string;
      if (chunks.length === 1) {
        fileName = `${nombreBase}.xls`;
      } else {
        fileName = `${nombreBase}_${idx + 1}.xls`;
      }

      const filePath = path.join(tempDir, fileName);

      XLSX.writeFile(newWorkbook, filePath, {
        bookType: 'xls',
        type: 'file',
      });

      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        archivosGenerados.push(filePath);
        nombresGenerados.push(fileName);
        tamanosGenerados.push(fs.statSync(filePath).size);
      }
    }

    if (archivosGenerados.length === 0) {
      throw new Error('No se pudo generar ningun archivo');
    }

    this.sessions.set(sessionId, {
      archivos: archivosGenerados,
      nombres: nombresGenerados,
      tempDir: tempDir,
      timestamp: Date.now(),
      registrosPorArchivo: registrosPorArchivo,
      totalRegistros: filasProcesadas.length,
    });

    setTimeout(() => {
      this.limpiarSesion(sessionId);
    }, 3600000);

    return {
      archivos: archivosGenerados,
      nombres: nombresGenerados,
      tamanos: tamanosGenerados,
      sessionId: sessionId,
      tempDir: tempDir,
      registrosPorArchivo: registrosPorArchivo,
      totalRegistros: filasProcesadas.length,
    };
  }

  private procesarFilas(
    filasData: any[][],
    indicesColumnas: number[],
    nuevosEncabezados: string[],
  ): any[][] {
    const esFecha = (valor: any): boolean => {
      return (
        valor !== null &&
        valor !== undefined &&
        typeof valor === 'object' &&
        Object.prototype.toString.call(valor) === '[object Date]' &&
        !isNaN(valor.getTime())
      );
    };

    return filasData.map((fila: any[]) => {
      const nuevaFila: any[] = [];
      for (let i = 0; i < nuevosEncabezados.length; i++) {
        const idxOriginal = indicesColumnas[i];
        let valor: any = '';

        if (
          idxOriginal !== -1 &&
          fila[idxOriginal] !== undefined &&
          fila[idxOriginal] !== null
        ) {
          valor = fila[idxOriginal];
        }

        if (typeof valor === 'number') {
          valor = String(valor);
        } else if (esFecha(valor)) {
          valor = this.formatearFechaExcel(valor);
        } else if (valor === undefined || valor === null) {
          valor = '';
        } else if (typeof valor === 'object') {
          try {
            valor = String(valor);
          } catch {
            valor = '';
          }
        }

        nuevaFila.push(valor);
      }
      return nuevaFila;
    });
  }

  private formatearFechaExcel(fecha: Date): string {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  private limpiarDatos(datos: any[][]): any[][] {
    if (!datos || datos.length === 0) return [];

    let maxColumnas = 0;
    for (const fila of datos) {
      if (fila && fila.length > maxColumnas) {
        maxColumnas = fila.length;
      }
    }

    const datosLimpios: any[][] = [];
    for (let i = 0; i < datos.length; i++) {
      const fila = datos[i];
      if (!fila) continue;

      const filaLimpia: any[] = [];
      for (let j = 0; j < maxColumnas; j++) {
        let valor = fila[j] !== undefined && fila[j] !== null ? fila[j] : '';
        if (typeof valor === 'string') {
          valor = valor.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ').trim();
        }
        filaLimpia.push(valor);
      }

      const tieneDatos = filaLimpia.some(
        (cell) => cell !== '' && cell !== null && cell !== undefined,
      );
      if (tieneDatos || i === 0) {
        datosLimpios.push(filaLimpia);
      }
    }

    return datosLimpios;
  }

  private obtenerNombreBanco(banco: string): string {
    const nombres: Record<string, string> = {
      SCOTIABANK: 'SCOT',
      BBVA: 'BBVA',
      ATT: 'ATT',
      GMF: 'GMF',
      TOYOTA: 'TYT',
    };
    return nombres[banco] || banco;
  }

  async getArchivoPorSession(
    sessionId: string,
    fileIndex: number,
  ): Promise<{ filePath: string; fileName: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sesion no encontrada o expirada');
    }
    if (!session.archivos[fileIndex]) {
      throw new Error('Archivo no encontrado');
    }
    return {
      filePath: session.archivos[fileIndex],
      fileName: session.nombres[fileIndex],
    };
  }

  async getSessionInfo(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sesion no encontrada o expirada');
    }
    return {
      sessionId: sessionId,
      archivos: session.nombres,
      registrosPorArchivo: session.registrosPorArchivo,
      totalRegistros: session.totalRegistros,
      expiraEn: Math.max(
        0,
        Math.floor((session.timestamp + 3600000 - Date.now()) / 1000),
      ),
    };
  }

  private async limpiarSesion(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        if (fs.existsSync(session.tempDir)) {
          await fs.promises.rm(session.tempDir, {
            recursive: true,
            force: true,
          });
        }
      } catch (error) {
        // Error silencioso
      }
      this.sessions.delete(sessionId);
    }
  }

  async limpiarArchivosTemporales(tempDir: string) {
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {}
  }
}
