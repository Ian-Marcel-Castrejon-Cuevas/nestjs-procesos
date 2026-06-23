import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as sql from 'mssql';
import * as cron from 'node-cron';
import * as XLSX from 'xlsx';

@Injectable()
export class ReporteService implements OnModuleInit {
  private readonly logger = new Logger(ReporteService.name);

  private getDbConfigDestino() {
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const server = process.env.DB_SERVER;
    const database = process.env.DB_DATABASE;
    const port = process.env.DB_PORT;

    if (!user || !password || !server || !database || !port) {
      throw new Error('Faltan variables de entorno para base de datos destino');
    }

    return {
      user,
      password,
      server,
      database,
      port: parseInt(port, 10),
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };
  }

  private getDbConfigOrigen() {
    return {
      user: 'sistemasAsecon',
      password: 'As3c0n2026i#',
      server: '192.168.8.146',
      database: 'CCReportsRIA',
      port: 1433,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };
  }

  async onModuleInit() {
    try {
      let testDestinoConn: sql.ConnectionPool | null = null;
      let testOrigenConn: sql.ConnectionPool | null = null;

      try {
        testDestinoConn = await sql.connect(this.getDbConfigDestino());
        testOrigenConn = await sql.connect(this.getDbConfigOrigen());
        this.logger.log('Servicio inicializado correctamente');
      } finally {
        if (testDestinoConn) testDestinoConn.close();
        if (testOrigenConn) testOrigenConn.close();
      }

      cron.schedule('00 03 * * *', () => {
        this.logger.log('Ejecutando tarea programada');
        this.procesarReporteAyer();
      });
    } catch (error) {
      this.logger.error(`Error inicializando servicio: ${error.message}`);
    }
  }

  private limpiarCadena(valor: any): string | null {
    if (!valor) return null;
    let limpio = String(valor).trim();
    limpio = limpio.replace(/[^\x20-\x7E]/g, '');
    if (limpio === '') return null;
    return limpio;
  }

  private normalizarFechaISO(fechaStr: string): string | null {
    if (!fechaStr) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return fechaStr;

    const partes = fechaStr.split('/');
    if (partes.length === 3) {
      const [dia, mes, anio] = partes;
      const anioNum = parseInt(anio, 10);
      const mesNum = parseInt(mes, 10);
      const diaNum = parseInt(dia, 10);

      if (
        anioNum >= 1900 &&
        anioNum <= 2100 &&
        mesNum >= 1 &&
        mesNum <= 12 &&
        diaNum >= 1 &&
        diaNum <= 31
      ) {
        return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
    }

    const fecha = new Date(fechaStr);
    if (!isNaN(fecha.getTime())) {
      return `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}-${fecha.getDate().toString().padStart(2, '0')}`;
    }

    return null;
  }

  private formatearFechaMostrar(fechaStr: string): string {
    if (!fechaStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
      const [anio, mes, dia] = fechaStr.split('-');
      return `${dia}/${mes}/${anio}`;
    }
    return fechaStr;
  }

  private async corregirTextosEnTabla(fechaStr: string) {
    let connection: sql.ConnectionPool | null = null;
    try {
      connection = await sql.connect(this.getDbConfigDestino());
      await connection.request().input('fecha', sql.VarChar, fechaStr).query(`
          UPDATE dbo.reporte_inbound 
          SET ESTADO_DE_LLAMADA = 'Desbordada (número en espera excedido)'
          WHERE ESTADO_DE_LLAMADA = 'Desbordada (nmero en espera excedido)'
          AND FECHA = @fecha
        `);
      this.logger.log(`Textos corregidos para fecha: ${fechaStr}`);
    } catch (error) {
      this.logger.error(`Error corrigiendo textos: ${error.message}`);
    } finally {
      if (connection) connection.close();
    }
  }

  async probarConexionDestino() {
    let connection: sql.ConnectionPool | null = null;
    try {
      connection = await sql.connect(this.getDbConfigDestino());
      const result = await connection
        .request()
        .query('SELECT GETDATE() as fecha, DB_NAME() as database_name');
      return {
        status: 'Conectado',
        server: process.env.DB_SERVER,
        database: result.recordset[0].database_name,
        fecha: result.recordset[0].fecha,
      };
    } catch (error) {
      throw new Error(`Error en destino: ${error.message}`);
    } finally {
      if (connection) connection.close();
    }
  }

  async probarConexionOrigen() {
    let connection: sql.ConnectionPool | null = null;
    try {
      connection = await sql.connect(this.getDbConfigOrigen());
      const result = await connection
        .request()
        .query('SELECT GETDATE() as fecha, DB_NAME() as database_name');
      return {
        status: 'Conectado',
        server: '192.168.8.146',
        database: result.recordset[0].database_name,
        fecha: result.recordset[0].fecha,
      };
    } catch (error) {
      throw new Error(`Error en origen: ${error.message}`);
    } finally {
      if (connection) connection.close();
    }
  }

  async probarTablaOrigen() {
    let connection: sql.ConnectionPool | null = null;
    try {
      connection = await sql.connect(this.getDbConfigOrigen());
      const result = await connection
        .request()
        .query(`SELECT TOP 5 * FROM RepInCallsDetail`);
      return {
        exitoso: true,
        registros: result.recordset.length,
        muestra: result.recordset.slice(0, 2),
      };
    } catch (error) {
      return {
        exitoso: false,
        error: error.message,
        sugerencia: 'La tabla RepInCallsDetail no existe o no se puede acceder',
      };
    } finally {
      if (connection) connection.close();
    }
  }

  async diagnosticarSQL(fechaStr: string) {
    let connectionOrigen: sql.ConnectionPool | null = null;

    try {
      const [dd, mm, yyyy] = fechaStr.split('-');
      const fechaInicio = `${yyyy}-${mm}-${dd} 08:00:00`;
      const fechaFin = `${yyyy}-${mm}-${dd} 21:00:00`;

      this.logger.log(`=== INICIANDO DIAGNÓSTICO SQL ===`);
      this.logger.log(`Fecha analizada: ${fechaStr}`);
      this.logger.log(`Rango: ${fechaInicio} a ${fechaFin}`);

      connectionOrigen = await sql.connect(this.getDbConfigOrigen());

      const result1 = await connectionOrigen
        .request()
        .input('fechaInicio', sql.VarChar, fechaInicio)
        .input('fechaFin', sql.VarChar, fechaFin).query(`
          SELECT COUNT(*) as total
          FROM RepInCallsDetail
          WHERE date >= @fechaInicio AND date <= @fechaFin
        `);

      const result2 = await connectionOrigen
        .request()
        .input('fechaInicio', sql.VarChar, fechaInicio)
        .input('fechaFin', sql.VarChar, fechaFin).query(`
          SELECT COUNT(*) as total
          FROM RepInCallsDetail
          WHERE date >= @fechaInicio AND date <= @fechaFin
            AND callStatus NOT IN ('Fuera de Horario', 'Inicial')
        `);

      const result3 = await connectionOrigen
        .request()
        .input('fechaInicio', sql.VarChar, fechaInicio)
        .input('fechaFin', sql.VarChar, fechaFin).query(`
          SELECT COUNT(*) as total
          FROM RepInCallsDetail
          WHERE date >= @fechaInicio AND date <= @fechaFin
            AND callStatus NOT IN ('Fuera de Horario', 'Inicial')
            AND ACDGroup <> 'Prueba IN'
        `);

      const result4 = await connectionOrigen
        .request()
        .input('fechaInicio', sql.VarChar, fechaInicio)
        .input('fechaFin', sql.VarChar, fechaFin).query(`
          SELECT COUNT(*) as total
          FROM RepInCallsDetail
          WHERE date >= @fechaInicio AND date <= @fechaFin
            AND callStatus NOT IN ('Fuera de Horario', 'Inicial')
            AND ACDGroup <> 'Prueba IN'
            AND ISNULL(dnis, '') <> ''
        `);

      const result5 = await connectionOrigen
        .request()
        .input('fechaInicio', sql.VarChar, fechaInicio)
        .input('fechaFin', sql.VarChar, fechaFin).query(`
          SELECT COUNT(*) as total
          FROM RepInCallsDetail
          WHERE date >= @fechaInicio AND date <= @fechaFin
            AND callStatus NOT IN ('Fuera de Horario', 'Inicial')
            AND ACDGroup <> 'Prueba IN'
            AND (dnis IS NULL OR dnis = '')
        `);

      this.logger.log(`=== RESULTADOS DEL DIAGNÓSTICO ===`);
      this.logger.log(
        `1. Total en rango de fecha: ${result1.recordset[0].total}`,
      );
      this.logger.log(
        `2. Excluyendo 'Fuera de Horario' e 'Inicial': ${result2.recordset[0].total} (filtrados: ${result1.recordset[0].total - result2.recordset[0].total})`,
      );
      this.logger.log(
        `3. Excluyendo también 'Prueba IN': ${result3.recordset[0].total} (filtrados: ${result2.recordset[0].total - result3.recordset[0].total})`,
      );
      this.logger.log(
        `4. Con todos los filtros (dnis no nulo): ${result4.recordset[0].total} (filtrados por dnis: ${result3.recordset[0].total - result4.recordset[0].total})`,
      );
      this.logger.log(
        `5. Registros excluidos por dnis nulo/vacío: ${result5.recordset[0].total}`,
      );

      this.logger.log(`=== RESUMEN ===`);
      this.logger.log(
        `Registros que obtendrá el código: ${result4.recordset[0].total}`,
      );

      if (result4.recordset[0].total !== 325) {
        this.logger.warn(
          `⚠️ DIFERENCIA DETECTADA: ${Math.abs(result4.recordset[0].total - 325)} registros de diferencia`,
        );

        const muestraExcluidos = await connectionOrigen
          .request()
          .input('fechaInicio', sql.VarChar, fechaInicio)
          .input('fechaFin', sql.VarChar, fechaFin).query(`
            SELECT TOP 5 
              date,
              callStatus,
              ACDGroup,
              dnis,
              callid
            FROM RepInCallsDetail
            WHERE date >= @fechaInicio AND date <= @fechaFin
              AND callStatus NOT IN ('Fuera de Horario', 'Inicial')
              AND ACDGroup <> 'Prueba IN'
              AND (dnis IS NULL OR dnis = '')
          `);

        if (muestraExcluidos.recordset.length > 0) {
          this.logger.log(
            `--- Ejemplo de registros excluidos por dnis nulo/vacío ---`,
          );
          muestraExcluidos.recordset.forEach((row, idx) => {
            this.logger.log(
              `${idx + 1}. Fecha: ${row.date}, Status: ${row.callStatus}, ACDGroup: ${row.ACDGroup}, dnis: "${row.dnis}", callid: ${row.callid}`,
            );
          });
        }
      } else {
        this.logger.log(`✅ Los registros coinciden con lo esperado`);
      }

      return {
        fecha: fechaStr,
        rango: { inicio: fechaInicio, fin: fechaFin },
        diagnosticos: {
          totalRango: result1.recordset[0].total,
          excluyendoStatus: result2.recordset[0].total,
          excluyendoPruebaIN: result3.recordset[0].total,
          conTodosFiltros: result4.recordset[0].total,
          excluidosPorDnis: result5.recordset[0].total,
        },
        diferencia: result4.recordset[0].total - 325,
        coincide: result4.recordset[0].total === 325,
      };
    } catch (error) {
      this.logger.error(`Error en diagnóstico: ${error.message}`);
      return null;
    } finally {
      if (connectionOrigen) connectionOrigen.close();
    }
  }

  private async obtenerDatosExcel(fechaStr: string): Promise<any[]> {
    try {
      const [dia, mes, año] = fechaStr.split('-');
      const fechaArchivo = `${año}-${mes}-${dia}`;
      const apiUrl = process.env.API_URL;

      if (!apiUrl) {
        this.logger.error('API_URL no configurada en variables de entorno');
        return [];
      }

      const nombreArchivo = `ReporteInbound_${fechaArchivo}.xls`;
      const url = `${apiUrl}/${nombreArchivo}`;

      this.logger.log(`Intentando descargar: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        this.logger.error(`Error descargando archivo: ${response.status}`);
        return [];
      }

      const arrayBuffer = await response.arrayBuffer();

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        this.logger.error(`Archivo vacío para fecha ${fechaStr}`);
        return [];
      }

      this.logger.log(`Archivo descargado: ${arrayBuffer.byteLength} bytes`);

      const buffer = Buffer.from(arrayBuffer);
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellDates: false,
      });

      const sheetName = workbook.SheetNames[0];
      const data: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: '',
        blankrows: false,
        raw: true,
      });

      this.logger.log(`Registros leídos del Excel: ${data.length}`);

      if (data.length === 0) {
        this.logger.warn(`El Excel está vacío para fecha ${fechaStr}`);
        return [];
      }

      const datosTransformados: any[] = [];

      for (const row of data) {
        let fechaISO: string | null = null;
        let horaSolo = '';
        let fechaCompleta = row['Fecha'];

        if (fechaCompleta) {
          if (typeof fechaCompleta === 'string') {
            let fechaStr = fechaCompleta;
            if (fechaCompleta.includes(' ')) {
              const partes = fechaCompleta.split(' ');
              fechaStr = partes[0];
              horaSolo = partes[1]?.substring(0, 5) || '';
            }

            const partesFecha = fechaStr.split('/');
            if (partesFecha.length === 3) {
              const diaExcel = partesFecha[0].padStart(2, '0');
              const mesExcel = partesFecha[1].padStart(2, '0');
              const añoExcel = partesFecha[2];

              fechaISO = `${añoExcel}-${mesExcel}-${diaExcel}`;

              this.logger.debug(`Fecha convertida: ${fechaStr} -> ${fechaISO}`);
            }
          } else if (typeof fechaCompleta === 'number') {
            const fecha = new Date((fechaCompleta - 25569) * 86400 * 1000);
            const añoUTC = fecha.getUTCFullYear();
            const mesUTC = (fecha.getUTCMonth() + 1)
              .toString()
              .padStart(2, '0');
            const diaUTC = fecha.getUTCDate().toString().padStart(2, '0');
            fechaISO = `${añoUTC}-${mesUTC}-${diaUTC}`;
            horaSolo = `${fecha.getUTCHours().toString().padStart(2, '0')}:${fecha.getUTCMinutes().toString().padStart(2, '0')}`;
          } else if (fechaCompleta instanceof Date) {
            const añoUTC = fechaCompleta.getUTCFullYear();
            const mesUTC = (fechaCompleta.getUTCMonth() + 1)
              .toString()
              .padStart(2, '0');
            const diaUTC = fechaCompleta
              .getUTCDate()
              .toString()
              .padStart(2, '0');
            fechaISO = `${añoUTC}-${mesUTC}-${diaUTC}`;
            horaSolo = `${fechaCompleta.getUTCHours().toString().padStart(2, '0')}:${fechaCompleta.getUTCMinutes().toString().padStart(2, '0')}`;
          }
        }

        if (fechaISO && fechaStr) {
          const [año, mes, dia] = fechaISO.split('-');
          const fechaEsperada = fechaStr.split('-');
          const diaEsperado = fechaEsperada[0];
          const mesEsperado = fechaEsperada[1];
          const añoEsperado = fechaEsperada[2];

          if (parseInt(mes) > 12 && parseInt(dia) <= 12) {
            this.logger.warn(
              `Fecha invertida detectada: ${fechaISO}, corrigiendo...`,
            );
            fechaISO = `${año}-${dia}-${mes}`;
            this.logger.warn(`Fecha corregida: ${fechaISO}`);
          }

          if (
            año !== añoEsperado ||
            mes !== mesEsperado ||
            dia !== diaEsperado
          ) {
            this.logger.warn(
              `Fecha no coincide con lo esperado: Esperada ${añoEsperado}-${mesEsperado}-${diaEsperado}, Obtenida ${fechaISO}`,
            );
            fechaISO = `${añoEsperado}-${mesEsperado}-${diaEsperado}`;
            this.logger.warn(`Fecha forzada a: ${fechaISO}`);
          }
        }

        let did = this.limpiarCadena(row['DID']);
        if (did && (did.includes(' ') || did.length > 50)) did = null;

        datosTransformados.push({
          FECHA: fechaISO,
          HORA: horaSolo || null,
          CAMPAÑA: this.limpiarCadena(row['Campa¤a'] || row['Campaña']),
          ESTADO_DE_LLAMADA: this.limpiarCadena(row['Estado_llamada']),
          ESTATUS: this.limpiarCadena(row['Status']),
          AREA: this.limpiarCadena(row['Area']),
          HERRAMIENTA: this.limpiarCadena(row['Med_Contacto']),
          DID: did,
          ORIGEN: this.limpiarCadena(row['Origen']),
          TIEMPO: row['Tiempo_llamada']
            ? this.limpiarCadena(String(row['Tiempo_llamada']))
            : null,
          ID_LLAMADA: this.limpiarCadena(row['Id_llamada']),
          ID_GRABACION: this.limpiarCadena(
            row['Id_grabaci¢n'] || row['Id_grabacion'],
          ),
          fuente: 'EXCEL',
        });
      }

      if (datosTransformados.length > 0) {
        this.logger.log(`Ejemplo de fecha convertida (primer registro):`);
        this.logger.log(`  Fecha original en Excel: ${data[0]['Fecha']}`);
        this.logger.log(`  Fecha convertida: ${datosTransformados[0].FECHA}`);
        this.logger.log(`  Hora: ${datosTransformados[0].HORA}`);
      }

      this.logger.log(
        `Registros transformados del Excel: ${datosTransformados.length}`,
      );

      return datosTransformados;
    } catch (error) {
      this.logger.error(
        `Error en obtenerDatosExcel para fecha ${fechaStr}: ${error.message}`,
      );
      this.logger.error(error.stack);
      return [];
    }
  }

  private async obtenerDatosSQL(fechaStr: string): Promise<any[]> {
    let connectionOrigen: sql.ConnectionPool | null = null;

    try {
      const [dd, mm, yyyy] = fechaStr.split('-');
      const fechaInicio = `${yyyy}-${mm}-${dd} 08:00:00`;
      const fechaFin = `${yyyy}-${mm}-${dd} 21:00:00`;

      this.logger.log(
        `Consultando SQL para fecha: ${fechaInicio} a ${fechaFin}`,
      );

      connectionOrigen = await sql.connect(this.getDbConfigOrigen());

      const result = await connectionOrigen
        .request()
        .input('fechaInicio', sql.VarChar, fechaInicio)
        .input('fechaFin', sql.VarChar, fechaFin).query(`
          SELECT
            date AS FechaCompleta,
            ACDGroup AS Campaña,
            callStatus AS Estado_llamada,
            CASE WHEN callStatus = 'Atendida' THEN 'Atendida' ELSE 'Abandonada' END AS Status,
            CASE 
              WHEN ACDGroup LIKE '%ATT%' THEN 'AT&T'
              WHEN ACDGroup LIKE '%REF%' THEN 'BBVA_REF'
              WHEN ACDGroup LIKE '%BBV%' THEN 'BBVA'
              WHEN ACDGroup LIKE '%GM%' THEN 'GMF'
              WHEN ACDGroup LIKE '%SCO%' THEN 'SCOTIABANK'
              WHEN ACDGroup LIKE '%TOY%' THEN 'TOYOTA'
              ELSE 'NUEVA'
            END AS Area,
            CASE 
              WHEN ACDGroup LIKE '%SMS%' THEN 'SMS'
              WHEN ACDGroup LIKE '%BLAS%' THEN 'BLASTER'
              WHEN ACDGroup LIKE '%IVR%' THEN 'BLASTER'
              WHEN ACDGroup LIKE '%MAIL%' THEN 'MAIL'
              WHEN ACDGroup LIKE '%VISIT%' THEN 'VISITA'
              WHEN ACDGroup = 'IN GMF CARTEO2' THEN 'CARTEO FINANCIERA'
              WHEN ACDGroup LIKE '%CAR%' THEN 'CARTEO'
              WHEN ACDGroup LIKE '%OUT%' THEN 'PREDICTIVA'
              ELSE 'OTRO'
            END AS Med_Contacto,
            dnis AS DID,
            ANI AS Origen,
            AverageHandleTime AS Tiempo_llamada,
            hour AS HoraOriginal,
            callid AS Id_llamada,
            grabId AS Id_grabación
          FROM RepInCallsDetail
          WHERE date >= @fechaInicio AND date <= @fechaFin
            AND callStatus NOT IN ('Fuera de Horario', 'Inicial')
            AND ACDGroup <> 'Prueba IN'
            AND ISNULL(dnis, '') <> ''
          ORDER BY date
        `);

      const registros = result.recordset;
      this.logger.log(
        `SQL: ${registros.length} registros obtenidos para fecha ${fechaStr}`,
      );

      const datosTransformados: any[] = [];

      for (const row of registros) {
        let fechaISO: string | null = null;
        let horaSolo = '';

        if (row.FechaCompleta) {
          const fechaObj = new Date(row.FechaCompleta);
          if (!isNaN(fechaObj.getTime())) {
            fechaISO = `${fechaObj.getFullYear()}-${(fechaObj.getMonth() + 1).toString().padStart(2, '0')}-${fechaObj.getDate().toString().padStart(2, '0')}`;
            horaSolo = `${fechaObj.getHours().toString().padStart(2, '0')}:${fechaObj.getMinutes().toString().padStart(2, '0')}`;
          }
        }

        if (!horaSolo && row.HoraOriginal) {
          const horaStr = row.HoraOriginal.toString();
          horaSolo =
            horaStr.length >= 5
              ? horaStr.substring(0, 5)
              : horaStr.padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2');
        }

        datosTransformados.push({
          FECHA: fechaISO,
          HORA: horaSolo || null,
          CAMPAÑA: row.Campaña || null,
          ESTADO_DE_LLAMADA: row.Estado_llamada || null,
          ESTATUS: row.Status || null,
          AREA: row.Area || null,
          HERRAMIENTA: row.Med_Contacto || null,
          DID: row.DID || null,
          ORIGEN: row.Origen || null,
          TIEMPO: row.Tiempo_llamada ? row.Tiempo_llamada.toString() : null,
          ID_LLAMADA: row.Id_llamada ? row.Id_llamada.toString() : null,
          ID_GRABACION: row.Id_grabación ? row.Id_grabación.toString() : null,
          fuente: 'SQL',
        });
      }

      this.logger.log(
        `SQL transformados: ${datosTransformados.length} registros`,
      );
      return datosTransformados;
    } catch (error) {
      this.logger.error(`Error consultando SQL: ${error.message}`);
      return [];
    } finally {
      if (connectionOrigen) connectionOrigen.close();
    }
  }

  private combinarYLimpiarDuplicados(
    datosExcel: any[],
    datosSQL: any[],
  ): any[] {
    const mapa = new Map();
    const registrosSinID: any[] = [];
    const duplicadosEnExcel: any[] = [];
    const duplicadosEnSQL: any[] = [];
    const duplicadosEntreFuentes: any[] = [];

    this.logger.log(`=== INICIANDO DEDUPLICACIÓN (SOLO POR ID_LLAMADA) ===`);
    this.logger.log(`Registros Excel: ${datosExcel.length}`);
    this.logger.log(`Registros SQL: ${datosSQL.length}`);

    for (const dato of datosExcel) {
      if (!dato.ID_LLAMADA) {
        registrosSinID.push(dato);
        continue;
      }

      const clave = dato.ID_LLAMADA;

      if (mapa.has(clave)) {
        duplicadosEnExcel.push({
          clave,
          registro: dato,
          registroExistente: mapa.get(clave),
        });
        this.logger.warn(`[DUPLICADO EN EXCEL] ID_LLAMADA: ${clave}`);
      } else {
        mapa.set(clave, dato);
      }
    }

    for (const dato of datosSQL) {
      if (!dato.ID_LLAMADA) {
        registrosSinID.push(dato);
        continue;
      }

      const clave = dato.ID_LLAMADA;

      if (mapa.has(clave)) {
        duplicadosEntreFuentes.push({
          clave,
          registroSQL: dato,
          registroExistente: mapa.get(clave),
        });
        this.logger.warn(
          `[DUPLICADO ENTRE FUENTES] ID_LLAMADA: ${clave} - Prevalece registro de ${mapa.get(clave).fuente || 'Excel'}`,
        );
      } else {
        mapa.set(clave, dato);
      }
    }

    if (registrosSinID.length > 0) {
      this.logger.warn(`=== REGISTROS SIN ID_LLAMADA ===`);
      this.logger.warn(
        `Total registros sin ID_LLAMADA: ${registrosSinID.length}`,
      );
      this.logger.warn(
        `Estos registros NO serán deduplicados y se insertarán todos`,
      );

      this.logger.log(
        `--- Ejemplos de registros sin ID_LLAMADA (primeros 3) ---`,
      );
      registrosSinID.slice(0, 3).forEach((reg, idx) => {
        this.logger.log(
          `${idx + 1}. FECHA: ${reg.FECHA}, HORA: ${reg.HORA}, CAMPAÑA: ${reg.CAMPAÑA}, DID: ${reg.DID}`,
        );
      });
    }

    this.logger.log(`=== RESUMEN DE DUPLICADOS POR ID_LLAMADA ===`);
    this.logger.log(`Duplicados dentro de Excel: ${duplicadosEnExcel.length}`);
    this.logger.log(`Duplicados dentro de SQL: ${duplicadosEnSQL.length}`);
    this.logger.log(
      `Duplicados entre Excel y SQL: ${duplicadosEntreFuentes.length}`,
    );

    const totalDuplicados =
      duplicadosEnExcel.length +
      duplicadosEnSQL.length +
      duplicadosEntreFuentes.length;
    this.logger.log(`Total duplicados eliminados: ${totalDuplicados}`);

    if (duplicadosEnExcel.length > 0) {
      this.logger.log(`--- Ejemplos duplicados en Excel (primeros 3) ---`);
      duplicadosEnExcel.slice(0, 3).forEach((dup, idx) => {
        this.logger.log(`${idx + 1}. ID_LLAMADA: ${dup.clave}`);
        this.logger.log(
          `   FECHA/HORA: ${dup.registro.FECHA} ${dup.registro.HORA}`,
        );
        this.logger.log(`   CAMPAÑA: ${dup.registro.CAMPAÑA}`);
      });
    }

    if (duplicadosEntreFuentes.length > 0) {
      this.logger.log(
        `--- Ejemplos duplicados entre Excel y SQL (primeros 3) ---`,
      );
      duplicadosEntreFuentes.slice(0, 3).forEach((dup, idx) => {
        this.logger.log(`${idx + 1}. ID_LLAMADA: ${dup.clave}`);
        this.logger.log(
          `   Excel - FECHA/HORA: ${dup.registroExistente.FECHA} ${dup.registroExistente.HORA}`,
        );
        this.logger.log(
          `   SQL - FECHA/HORA: ${dup.registroSQL.FECHA} ${dup.registroSQL.HORA}`,
        );
        this.logger.log(
          `   Prevalece: REGISTRO DE ${dup.registroExistente.fuente || 'Excel'}`,
        );
      });
    }

    const registrosConID = mapa.size;
    const totalRegistrosFinales = registrosConID + registrosSinID.length;

    this.logger.log(`=== ESTADÍSTICAS FINALES ===`);
    this.logger.log(`Registros con ID_LLAMADA únicos: ${registrosConID}`);
    this.logger.log(
      `Registros sin ID_LLAMADA (todos insertados): ${registrosSinID.length}`,
    );
    this.logger.log(`Total registros a insertar: ${totalRegistrosFinales}`);

    if (datosExcel.length + datosSQL.length > 0) {
      const tasaDuplicacion =
        (totalDuplicados / (datosExcel.length + datosSQL.length)) * 100;
      this.logger.log(`Tasa de duplicación: ${tasaDuplicacion.toFixed(2)}%`);
    }

    if (registrosSinID.length > 0) {
      this.logger.log(`=== IMPORTANTE ===`);
      this.logger.log(
        `Los registros sin ID_LLAMADA NO se comparan para evitar duplicados`,
      );
      this.logger.log(
        `Si hay registros repetidos sin ID, se insertarán todos (posibles duplicados reales)`,
      );
    }

    const resultado = [...Array.from(mapa.values()), ...registrosSinID];

    return resultado;
  }

  private async insertarDatosEnTabla(
    datos: any[],
    fechaStr: string,
  ): Promise<{ insertados: number; errores: number }> {
    let connectionDestino: sql.ConnectionPool | null = null;
    let insertados = 0;
    let errores = 0;

    try {
      connectionDestino = await sql.connect(this.getDbConfigDestino());

      for (const row of datos) {
        try {
          const request = connectionDestino.request();

          request.input('FECHA', sql.Date, row.FECHA);
          request.input('HORA', sql.VarChar, row.HORA);
          request.input('CAMPAÑA', sql.NVarChar, row.CAMPAÑA);
          request.input(
            'ESTADO_DE_LLAMADA',
            sql.NVarChar,
            row.ESTADO_DE_LLAMADA,
          );
          request.input('ESTATUS', sql.NVarChar, row.ESTATUS);
          request.input('AREA', sql.NVarChar, row.AREA);
          request.input('HERRAMIENTA', sql.NVarChar, row.HERRAMIENTA);
          request.input('DID', sql.VarChar, row.DID);
          request.input('ORIGEN', sql.VarChar, row.ORIGEN);
          request.input('TIEMPO', sql.VarChar, row.TIEMPO);
          request.input('ID_LLAMADA', sql.VarChar, row.ID_LLAMADA);
          request.input('ID_GRABACION', sql.VarChar, row.ID_GRABACION);

          await request.query(`
            INSERT INTO dbo.reporte_inbound (
              FECHA, HORA, CAMPAÑA, ESTADO_DE_LLAMADA, ESTATUS, AREA, HERRAMIENTA,
              DID, ORIGEN, TIEMPO, ID_LLAMADA, ID_GRABACION
            ) VALUES (
              @FECHA, @HORA, @CAMPAÑA, @ESTADO_DE_LLAMADA, @ESTATUS, @AREA, @HERRAMIENTA,
              @DID, @ORIGEN, @TIEMPO, @ID_LLAMADA, @ID_GRABACION
            )
          `);
          insertados++;
        } catch (err) {
          errores++;
          this.logger.error(`Error insertando registro: ${err.message}`);
          if (err.message.includes('date')) {
            this.logger.error(
              `Datos problemáticos - FECHA: ${row.FECHA}, HORA: ${row.HORA}, ID: ${row.ID_LLAMADA}`,
            );
          }
        }
      }

      if (insertados > 0) {
        const fechaISO = datos[0]?.FECHA;
        if (fechaISO) {
          await this.corregirTextosEnTabla(fechaISO);
        }
      }

      this.logger.log(`Insertados: ${insertados}, Errores: ${errores}`);
      return { insertados, errores };
    } catch (error) {
      this.logger.error(`Error insertando datos: ${error.message}`);
      return { insertados, errores };
    } finally {
      if (connectionDestino) connectionDestino.close();
    }
  }

  async procesarAmbasFuentesCombinadas(fechaStr: string) {
    this.logger.log(`Procesando fecha: ${fechaStr}`);

    try {
      await this.diagnosticarSQL(fechaStr);

      const datosExcel = await this.obtenerDatosExcel(fechaStr);
      const datosSQL = await this.obtenerDatosSQL(fechaStr);
      const datosCombinados = this.combinarYLimpiarDuplicados(
        datosExcel,
        datosSQL,
      );
      const duplicadosEliminados =
        datosExcel.length + datosSQL.length - datosCombinados.length;
      const resultadoInsercion = await this.insertarDatosEnTabla(
        datosCombinados,
        fechaStr,
      );

      if (resultadoInsercion.errores === 0) {
        this.logger.log(
          `Procesamiento exitoso: ${resultadoInsercion.insertados} registros insertados`,
        );
      } else {
        this.logger.error(
          `Procesamiento con errores: ${resultadoInsercion.insertados} insertados, ${resultadoInsercion.errores} errores`,
        );
      }

      return {
        fecha: fechaStr,
        fuentes: {
          excel: { total: datosExcel.length },
          sql: { total: datosSQL.length },
        },
        procesamiento: {
          totalRegistros: datosCombinados.length,
          duplicadosEliminados: duplicadosEliminados,
          insertados: resultadoInsercion.insertados,
          errores: resultadoInsercion.errores,
        },
        exitoso: resultadoInsercion.errores === 0,
      };
    } catch (error) {
      this.logger.error(`Error procesando fecha ${fechaStr}: ${error.message}`);
      return {
        fecha: fechaStr,
        exitoso: false,
        mensaje: `Error: ${error.message}`,
      };
    }
  }

  async procesarReporteAyer() {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const fechaStr = `${String(ayer.getDate()).padStart(2, '0')}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${ayer.getFullYear()}`;
    return this.procesarAmbasFuentesCombinadas(fechaStr);
  }

  async procesarFechaEspecifica(fechaStr: string) {
    return this.procesarAmbasFuentesCombinadas(fechaStr);
  }

  async corregirTextos(fechaStr: string) {
    return this.corregirTextosEnTabla(fechaStr);
  }

  async procesarReporteExcel(fechaStr: string) {
    const datos = await this.obtenerDatosExcel(fechaStr);
    const resultado = await this.insertarDatosEnTabla(datos, fechaStr);
    return {
      insertados: resultado.insertados,
      errores: resultado.errores,
      mensaje: 'Excel procesado',
    };
  }

  async procesarReporteSQL(fechaStr: string) {
    const datos = await this.obtenerDatosSQL(fechaStr);
    const resultado = await this.insertarDatosEnTabla(datos, fechaStr);
    return {
      insertados: resultado.insertados,
      errores: resultado.errores,
      mensaje: 'SQL procesado',
    };
  }

  async procesarAmbasFuentes(fechaStr: string) {
    return this.procesarAmbasFuentesCombinadas(fechaStr);
  }
}
