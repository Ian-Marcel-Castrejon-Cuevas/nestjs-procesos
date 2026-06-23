import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const AdmZip = require('adm-zip');

@Injectable()
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

  async procesarArchivoSinZip(
    fileBuffer: Buffer,
    banco: string,
    tipoArchivo: string,
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
    console.log('========== INICIO PROCESAMIENTO SIN ZIP ==========');
    console.log(`Banco: ${banco}, Tipo: ${tipoArchivo}`);
    console.log(`Nombre archivo original: ${originalFilename}`);

    const esZipPorExtension =
      originalFilename?.toLowerCase().endsWith('.zip') || false;

    let workbook;
    let datosLimpios;

    if (esZipPorExtension) {
      console.log('📦 Detectado archivo ZIP por extensión, extrayendo...');
      try {
        const excelBuffer = await this.extraerExcelDeZip(fileBuffer);
        workbook = XLSX.read(excelBuffer, {
          type: 'buffer',
          cellFormula: false,
          cellHTML: false,
          cellNF: false,
          sheetStubs: false,
        });
      } catch (error) {
        console.error('Error extrayendo ZIP:', error);
        throw new Error(
          'No se pudo extraer el archivo Excel del ZIP. Asegúrate de que el ZIP contenga un archivo .xlsx o .xls',
        );
      }
    } else {
      console.log('📄 Procesando archivo Excel directamente');
      try {
        workbook = XLSX.read(fileBuffer, {
          type: 'buffer',
          cellFormula: false,
          cellHTML: false,
          cellNF: false,
          sheetStubs: false,
        });
      } catch (error) {
        console.error('Error leyendo Excel:', error);
        throw new Error('El archivo no es un Excel válido o está corrupto');
      }
    }

    const nombreHoja = workbook.SheetNames[0];
    const hojaOriginal = workbook.Sheets[nombreHoja];

    const jsonData = XLSX.utils.sheet_to_json(hojaOriginal, {
      header: 1,
      defval: '',
      blankrows: true,
    });

    datosLimpios = this.limpiarDatos(jsonData as any[][]);

    if (!datosLimpios || datosLimpios.length === 0) {
      throw new Error('El archivo está vacío o corrupto');
    }

    console.log(
      `Original: ${datosLimpios[0]?.length || 0} columnas, ${datosLimpios.length} filas`,
    );

    const encabezadosOriginales = datosLimpios[0];
    const { nuevosEncabezados, indicesColumnas } =
      this.detectarColumnasFlexible(encabezadosOriginales, banco, tipoArchivo);

    console.log(
      `Columnas que se conservarán: ${nuevosEncabezados.join(' | ')}`,
    );

    let filasData = datosLimpios.slice(1);
    console.log(`Total de registros a procesar: ${filasData.length}`);

    let filasProcesadas = this.procesarFilas(
      filasData,
      indicesColumnas,
      nuevosEncabezados,
    );

    console.log(`Registros procesados: ${filasProcesadas.length}`);

    const chunks: any[][][] = [];
    for (let i = 0; i < filasProcesadas.length; i += this.CHUNK_SIZE) {
      const chunk = filasProcesadas.slice(i, i + this.CHUNK_SIZE);
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    console.log(`\n📊 División en ${chunks.length} archivo(s):`);
    const registrosPorArchivo: number[] = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      registrosPorArchivo.push(chunks[idx].length);
      console.log(
        `  Archivo ${idx + 1}: ${chunks[idx].length} registros + 1 título = ${chunks[idx].length + 1} filas totales`,
      );
    }

    const sessionId = `${banco}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tempDir = path.join(process.cwd(), 'temp', sessionId);
    fs.mkdirSync(tempDir, { recursive: true });

    const fecha = new Date();
    const fechaStr = this.formatearFecha(fecha);
    const archivosGenerados: string[] = [];
    const nombresGenerados: string[] = [];
    const tamanosGenerados: number[] = [];

    const nombreBanco = this.obtenerNombreBanco(banco);
    let prefijo = '';
    if (tipoArchivo === 'LEYENDAS') {
      prefijo = 'LEY_';
    } else if (tipoArchivo === 'GESTIONES') {
      prefijo = 'GES_';
    }

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

      XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Sheet1');

      let fileName: string;
      if (chunks.length === 1) {
        fileName = `${prefijo}${nombreBanco}_${fechaStr}.xls`;
      } else {
        fileName = `${prefijo}${nombreBanco}_${fechaStr}_${String(idx + 1).padStart(2, '0')}.xls`;
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
        console.log(`Generado: ${fileName} (${chunk.length} registros)`);
      }
    }

    if (archivosGenerados.length === 0) {
      throw new Error('No se pudo generar ningún archivo');
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

    console.log('========== FIN PROCESAMIENTO SIN ZIP ==========');
    console.log(`Sesión: ${sessionId}`);
    console.log(`Archivos generados: ${archivosGenerados.length}`);

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

  private async extraerExcelDeZip(zipBuffer: Buffer): Promise<Buffer> {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    console.log(
      `Buscando archivos Excel en ZIP. Total entradas: ${zipEntries.length}`,
    );

    const excelEntry = zipEntries.find(
      (entry) =>
        !entry.isDirectory &&
        (entry.entryName.toLowerCase().endsWith('.xlsx') ||
          entry.entryName.toLowerCase().endsWith('.xls')),
    );

    if (!excelEntry) {
      const filesInZip = zipEntries
        .filter((entry) => !entry.isDirectory)
        .map((entry) => entry.entryName)
        .join(', ');
      console.log(`Archivos encontrados en ZIP: ${filesInZip}`);
      throw new Error(
        `No se encontró ningún archivo Excel (.xlsx o .xls) dentro del ZIP. Archivos encontrados: ${filesInZip || 'ninguno'}`,
      );
    }

    console.log(`Archivo Excel encontrado en ZIP: ${excelEntry.entryName}`);
    return excelEntry.getData();
  }

  async getArchivoPorSession(
    sessionId: string,
    fileIndex: number,
  ): Promise<{ filePath: string; fileName: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sesión no encontrada o expirada');
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
      throw new Error('Sesión no encontrada o expirada');
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
          console.log(`🧹 Sesión ${sessionId} limpiada correctamente`);
        }
      } catch (error) {
        console.error(`Error limpiando sesión ${sessionId}:`, error);
      }
      this.sessions.delete(sessionId);
    }
  }

  private detectarColumnasFlexible(
    encabezadosOriginales: any[],
    banco: string,
    tipoArchivo: string,
  ): { nuevosEncabezados: string[]; indicesColumnas: number[] } {
    const encabezadosNormales = encabezadosOriginales.map((h) =>
      h ? h.toString().toLowerCase().trim() : '',
    );

    console.log('\n📋 Encabezados encontrados en el archivo:');
    console.log(encabezadosNormales.slice(0, 20));

    let columnasBuscadas: string[] = [];
    let descripcion = '';

    if (tipoArchivo === 'LEYENDAS') {
      columnasBuscadas = ['CLAVE', 'STATUS', 'FOLIO', 'LEYENDA'];
      descripcion = 'LEYENDAS';
    } else if (tipoArchivo === 'GESTIONES') {
      columnasBuscadas = [
        'CLAVE',
        'FECHA',
        'TIPO',
        'TELEFONO',
        'COD_ACC',
        'COD_RES',
        'HORARIO',
        'LEYENDA',
      ];
      descripcion = 'GESTIONES';
    }

    console.log(`\n🎯 Modo: ${banco} - ${descripcion}`);
    console.log(`📌 Buscando columnas: ${columnasBuscadas.join(' | ')}`);

    const indicesColumnas: number[] = [];
    const nuevosEncabezados: string[] = [];

    for (const columnaBuscada of columnasBuscadas) {
      let index = -1;
      let encontrado = '';

      index = encabezadosNormales.findIndex(
        (h) => h === columnaBuscada.toLowerCase(),
      );

      if (index === -1) {
        if (columnaBuscada === 'CLAVE') {
          const variaciones = [
            'clave',
            'cuenta',
            'numero',
            'id',
            'identificador',
            'codigo',
          ];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'FECHA') {
          const variaciones = ['fecha', 'date', 'fech', 'dia'];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'TIPO') {
          const variaciones = ['tipo', 'type', 'categoria', 'clasificacion'];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'TELEFONO') {
          const variaciones = ['telefono', 'tel', 'phone', 'celular', 'movil'];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'COD_ACC') {
          const variaciones = [
            'cod_acc',
            'codigo',
            'cod',
            'cuenta',
            'id_cuenta',
          ];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'COD_RES') {
          const variaciones = ['cod_res', 'res', 'resultado', 'codigo_res'];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'HORARIO') {
          const variaciones = ['horario', 'hora', 'turno', 'schedule'];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'STATUS') {
          const variaciones = ['status', 'estado', 'situacion'];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'FOLIO') {
          const variaciones = ['folio', 'numero', 'referencia', 'num'];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        } else if (columnaBuscada === 'LEYENDA') {
          const variaciones = [
            'leyenda',
            'leyendas',
            'descripcion',
            'texto',
            'mensaje',
            'observacion',
            'detalle',
            'comentario',
            'nota',
            'glosa',
            'concepto',
            'motivo',
          ];
          for (const variacion of variaciones) {
            index = encabezadosNormales.findIndex((h) => h.includes(variacion));
            if (index !== -1) {
              encontrado = variacion;
              break;
            }
          }
        }
      }

      if (index !== -1) {
        indicesColumnas.push(index);
        nuevosEncabezados.push(encabezadosOriginales[index]);
        const mensaje = encontrado ? `(como "${encontrado}")` : '';
        console.log(
          `  ✓ Encontrado: "${columnaBuscada}" ${mensaje} → "${encabezadosOriginales[index]}"`,
        );
      } else {
        indicesColumnas.push(-1);
        nuevosEncabezados.push(columnaBuscada);
        console.log(`  ✗ No encontrado: "${columnaBuscada}" (se creará vacío)`);
      }
    }

    console.log(
      `\nColumnas finales del archivo de salida: ${nuevosEncabezados.join(' | ')}`,
    );
    return { nuevosEncabezados, indicesColumnas };
  }

  private procesarFilas(
    filasData: any[][],
    indicesColumnas: number[],
    nuevosEncabezados: string[],
  ): any[][] {
    return filasData.map((fila: any[]) => {
      const nuevaFila: any[] = [];
      for (let i = 0; i < nuevosEncabezados.length; i++) {
        const idxOriginal = indicesColumnas[i];
        let valor = '';

        if (
          idxOriginal !== -1 &&
          fila[idxOriginal] !== undefined &&
          fila[idxOriginal] !== null
        ) {
          valor = fila[idxOriginal];
        }

        const nombreColumna = nuevosEncabezados[i].toUpperCase();

        if (
          nombreColumna === 'CLAVE' ||
          nombreColumna === 'FECHA' ||
          nombreColumna === 'TELEFONO'
        ) {
          valor = this.convertirATexto(valor, nombreColumna);
        } else if (typeof valor === 'number') {
          valor = String(valor);
        } else if (valor === undefined || valor === null) {
          valor = '';
        }

        nuevaFila.push(valor);
      }
      return nuevaFila;
    });
  }

  private convertirATexto(valor: any, columna: string): string {
    if (valor === undefined || valor === null || valor === '') {
      return '';
    }

    if (columna === 'FECHA' && typeof valor === 'number') {
      const fecha = new Date(1900, 0, valor - 1);
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();
      return `${dia}/${mes}/${anio}`;
    }

    if (
      (columna === 'CLAVE' || columna === 'TELEFONO') &&
      typeof valor === 'number'
    ) {
      return valor.toString();
    }

    if (typeof valor === 'string') {
      return valor;
    }

    return String(valor);
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

  private formatearFecha(fecha: Date): string {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear().toString().slice(-2);
    return `${dia}${mes}${anio}`;
  }

  private obtenerNombreBanco(banco: string): string {
    const nombres: Record<string, string> = {
      SCOTIABANK: 'SCOT',
      BBVA: 'BBVA',
      ATT: 'ATT',
      GMF: 'GMF',
      TOYOTA: 'TOYOTA',
    };
    return nombres[banco] || banco;
  }

  async limpiarArchivosTemporales(tempDir: string) {
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        console.log('🧹 Limpieza completada');
      }
    } catch (error) {
      console.error('Error limpiando:', error);
    }
  }
}
