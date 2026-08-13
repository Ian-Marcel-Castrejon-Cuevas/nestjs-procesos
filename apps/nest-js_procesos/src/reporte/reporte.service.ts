import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as sql from 'mssql';
import * as cron from 'node-cron';
import * as XLSX from 'xlsx';

@Injectable()
/**
 * Servicio encargado de obtener reportes desde el portal y desde SQL,
 * normalizar los datos y cargarlos en la tabla destino `reporte_inbound`.
 * Implementa reintentos y utilidades de diagnóstico.
 */
export class ReporteService implements OnModuleInit {
  private readonly logger = new Logger(ReporteService.name);
  private readonly PORTAL_BASE_URL: string;
  private readonly PORTAL_USER: string;
  private readonly PORTAL_PASSWORD: string;
  private sessionCookies: string = '';
  private readonly MAX_REINTENTOS = 10;
  private readonly INTERVALO_REINTENTO = 60000; // 1 minuto

  /**
   * Constructor: inicializa variables de configuración del portal (lee env).
   */
  constructor() {
    this.PORTAL_BASE_URL = this.obtenerVariableEntorno(
      'PORTAL_BASE_URL',
      'https://cwxion66.nuxiba.com/sitioreportes',
    );
    this.PORTAL_USER = this.obtenerVariableEntorno(
      'PORTAL_USER',
      'admin_cliente',
    );
    this.PORTAL_PASSWORD = this.obtenerVariableEntorno(
      'PORTAL_PASSWORD',
      'V9#qL7@mX2!rN8',
    );

    this.logger.log(`Portal configurado: ${this.PORTAL_BASE_URL}`);
    this.logger.log(`Usuario: ${this.PORTAL_USER}`);
    this.logger.log(`Contraseña: ${'*'.repeat(this.PORTAL_PASSWORD.length)}`);
  }

  private obtenerVariableEntorno(
    nombre: string,
    valorPorDefecto: string,
  ): string {
    let valor = process.env[nombre];

    if (!valor) {
      return valorPorDefecto;
    }

    valor = valor.trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    return valor;
  }

  /**
   * Obtiene la configuración de conexión para la base de datos destino
   * leyendo las variables de entorno (`DB_USER`, `DB_PASSWORD`, `DB_SERVER`,
   * `DB_DATABASE`, `DB_PORT`). Lanza error si falta alguna variable.
   */
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

  /**
   * Devuelve la configuración de conexión al origen (base de datos legacy).
   * NOTA: actualmente contiene credenciales en claro; se recomienda externalizar.
   */
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

  /**
   * Pausa asincrónica por `ms` milisegundos. Usada para backoff entre reintentos.
   * @param ms Tiempo en milisegundos a esperar.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

      cron.schedule('00 07 * * *', () => {
        this.logger.log('Ejecutando tarea programada');
        this.procesarReporteAyerConReintentos();
      });

      try {
        await this.autenticarPortal();
        this.logger.log('Autenticacion inicial en portal Nuxiba exitosa');
      } catch (error) {
        this.logger.warn(`Error en autenticacion inicial: ${error.message}`);
      }
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

  /**
   * Corrige textos mal escritos en la tabla `reporte_inbound` para la fecha dada.
   * Realiza un UPDATE parametrizado en la base de datos destino.
   * @param fechaStr Fecha en formato `YYYY-MM-DD`.
   */
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

  /**
   * Autentica en el portal Nuxiba y establece `this.sessionCookies`.
   * Maneja CSRF, cookies, redirecciones y errores de autenticación.
   * Lanza excepción si no puede autenticarse.
   */
  private async autenticarPortal(): Promise<void> {
    try {
      this.logger.log(`Iniciando autenticacion en portal Nuxiba`);
      this.logger.log(`URL Base: ${this.PORTAL_BASE_URL}`);
      this.logger.log(`Usuario: ${this.PORTAL_USER}`);
      this.logger.log(`Contraseña: ${'*'.repeat(this.PORTAL_PASSWORD.length)}`);

      const loginUrl = `${this.PORTAL_BASE_URL}/`;
      this.logger.log(`Obteniendo pagina de login: ${loginUrl}`);

      const loginPageResponse = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      this.logger.log(
        `Status de respuesta: ${loginPageResponse.status} ${loginPageResponse.statusText}`,
      );

      if (!loginPageResponse.ok) {
        throw new Error(
          `Error al obtener pagina de login: ${loginPageResponse.status} - ${loginPageResponse.statusText}`,
        );
      }

      const loginHtml = await loginPageResponse.text();
      let csrfToken: string | null = null;

      const tokenMatchStandard = loginHtml.match(
        /name="__RequestVerificationToken" value="([^"]+)"/,
      );
      if (tokenMatchStandard) {
        csrfToken = tokenMatchStandard[1];
        this.logger.log('Token CSRF encontrado (formato estandar)');
      }

      if (!csrfToken) {
        const tokenMatchSingle = loginHtml.match(
          /name=['"]__RequestVerificationToken['"] value=['"]([^'"]+)['"]/,
        );
        if (tokenMatchSingle) {
          csrfToken = tokenMatchSingle[1];
          this.logger.log('Token CSRF encontrado (formato comillas simples)');
        }
      }

      if (!csrfToken) {
        const formMatch = loginHtml.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
        if (formMatch) {
          const formContent = formMatch[1];
          const hiddenMatch = formContent.match(
            /<input[^>]*name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i,
          );
          if (hiddenMatch) {
            csrfToken = hiddenMatch[1];
            this.logger.log('Token CSRF encontrado (dentro del formulario)');
          }
        }
      }

      if (!csrfToken) {
        this.logger.warn(
          'No se pudo encontrar token CSRF, intentando login sin token...',
        );
        csrfToken = '';
      } else {
        this.logger.log(
          `Token CSRF obtenido: ${csrfToken.substring(0, 15)}...`,
        );
      }

      const cookies = loginPageResponse.headers.get('set-cookie');
      if (cookies) {
        this.sessionCookies = cookies.split(';')[0];
        this.logger.log(`Cookies iniciales obtenidas`);
      }

      this.logger.log('Enviando credenciales al portal...');

      const loginData = new URLSearchParams({
        Username: this.PORTAL_USER,
        Password: this.PORTAL_PASSWORD,
        ReturnUrl: '',
        ...(csrfToken && { __RequestVerificationToken: csrfToken }),
      });

      const loginResponse = await fetch(`${this.PORTAL_BASE_URL}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: this.sessionCookies,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        body: loginData.toString(),
        redirect: 'manual',
      });

      this.logger.log(`Status de login: ${loginResponse.status}`);

      if (loginResponse.status === 302) {
        const location = loginResponse.headers.get('location');
        this.logger.log(`Redireccion recibida: ${location}`);

        if (location) {
          const newCookies = loginResponse.headers.get('set-cookie');
          if (newCookies) {
            this.sessionCookies = newCookies.split(';')[0];
            this.logger.log(`Cookies actualizadas`);
          }

          await fetch(`${this.PORTAL_BASE_URL}${location}`, {
            method: 'GET',
            headers: {
              Cookie: this.sessionCookies,
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });

          this.logger.log(`Autenticacion exitosa en portal Nuxiba`);
          return;
        }
      }

      const responseText = await loginResponse.text();

      if (
        responseText.includes('Portal Reportes Nuxiba') &&
        responseText.includes('Admin Cliente')
      ) {
        this.logger.log('Autenticacion exitosa - Dashboard detectado');
        const newCookies = loginResponse.headers.get('set-cookie');
        if (newCookies) {
          this.sessionCookies = newCookies.split(';')[0];
        }
        return;
      }

      if (
        responseText.includes('Iniciar sesión') ||
        responseText.includes('Usuario o contraseña incorrectos')
      ) {
        this.logger.error('Credenciales invalidas');
        throw new Error('Credenciales invalidas');
      }

      this.logger.log(`Autenticacion exitosa`);
    } catch (error) {
      this.logger.error(`Error en autenticacion: ${error.message}`);
      throw new Error(`Fallo en autenticacion: ${error.message}`);
    }
  }

  private async obtenerUrlDescargaExcel(
    fechaStr: string,
  ): Promise<string | null> {
    /**
     * Busca en el portal la URL de descarga del Excel correspondiente a `fechaStr`.
     * Devuelve la URL absoluta si se encuentra, o `null` en caso contrario.
     * @param fechaStr Fecha en formato `YYYY-MM-DD`.
     */
    try {
      const [dia, mes, año] = fechaStr.split('-');
      const nombreArchivoBuscado = `ReporteInbound_${año}-${mes}-${dia}.xls`;

      this.logger.log(`Buscando archivo: ${nombreArchivoBuscado}`);

      const response = await fetch(`${this.PORTAL_BASE_URL}/Home/Index`, {
        method: 'GET',
        headers: {
          Cookie: this.sessionCookies,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Error al obtener lista de archivos: ${response.status}`,
        );
      }

      const html = await response.text();
      let urlDescarga: string | null = null;

      const rowRegex =
        /<tr[^>]*class="[^"]*animate-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
      let match;
      let filaEncontrada = false;

      while ((match = rowRegex.exec(html)) !== null) {
        const rowContent = match[1];

        if (rowContent.includes(nombreArchivoBuscado)) {
          filaEncontrada = true;
          this.logger.log(`Fila encontrada para: ${nombreArchivoBuscado}`);

          const linkRegex =
            /<a[^>]*class="[^"]*download-btn[^"]*"[^>]*href="([^"]*)"[^>]*>/i;
          const linkMatch = rowContent.match(linkRegex);

          if (linkMatch && linkMatch[1]) {
            urlDescarga = linkMatch[1];
            this.logger.log(
              `Enlace de descarga encontrado en la fila: ${urlDescarga}`,
            );
            break;
          }
        }
      }

      if (!urlDescarga) {
        this.logger.log('Buscando enlace de descarga directamente...');

        const linkRegex =
          /<a[^>]*class="[^"]*download-btn[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?([^<]+)<\/a>/gi;
        let linkMatch;

        while ((linkMatch = linkRegex.exec(html)) !== null) {
          const href = linkMatch[1];
          const text = linkMatch[2].trim();

          if (text.includes(nombreArchivoBuscado)) {
            urlDescarga = href;
            this.logger.log(`Enlace encontrado por texto: ${urlDescarga}`);
            break;
          }
        }
      }

      if (!urlDescarga) {
        this.logger.log('Buscando enlace por URL codificada...');

        const encodedFileName = encodeURIComponent(nombreArchivoBuscado);
        const allLinksRegex =
          /<a[^>]*href="([^"]*\/Reports\/Download\?fileName=[^"]*)"[^>]*>/gi;
        let linkMatch;

        while ((linkMatch = allLinksRegex.exec(html)) !== null) {
          const href = linkMatch[1];
          try {
            const decoded = decodeURIComponent(href);
            if (
              decoded.includes(nombreArchivoBuscado) ||
              href.includes(encodedFileName)
            ) {
              urlDescarga = href;
              this.logger.log(
                `Enlace encontrado por URL codificada: ${urlDescarga}`,
              );
              break;
            }
          } catch (e) {
            // Continuar
          }
        }
      }

      if (!urlDescarga) {
        this.logger.log(
          `Buscando enlace que contenga la fecha ${año}-${mes}-${dia}...`,
        );

        const allLinksRegex = /<a[^>]*href="([^"]*)"[^>]*>/gi;
        let linkMatch;

        while ((linkMatch = allLinksRegex.exec(html)) !== null) {
          const href = linkMatch[1];
          if (href.includes(`ReporteInbound_${año}-${mes}-${dia}`)) {
            urlDescarga = href;
            this.logger.log(
              `Enlace encontrado por fecha en URL: ${urlDescarga}`,
            );
            break;
          }
        }
      }

      if (urlDescarga) {
        let urlCompleta = urlDescarga;

        if (urlCompleta.startsWith('/sitioreportes/sitioreportes')) {
          urlCompleta = urlCompleta.replace(
            '/sitioreportes/sitioreportes',
            '/sitioreportes',
          );
          this.logger.log(
            `URL corregida (duplicado eliminado): ${urlCompleta}`,
          );
        }

        if (!urlCompleta.startsWith('http')) {
          urlCompleta = `${this.PORTAL_BASE_URL}${urlCompleta}`;
        }

        if (urlCompleta.includes('/sitioreportes/sitioreportes')) {
          urlCompleta = urlCompleta.replace(
            '/sitioreportes/sitioreportes',
            '/sitioreportes',
          );
          this.logger.log(`URL absoluta corregida: ${urlCompleta}`);
        }

        this.logger.log(`URL de descarga final: ${urlCompleta}`);
        return urlCompleta;
      }

      this.logger.error(
        `No se encontró el archivo ${nombreArchivoBuscado} en el portal`,
      );
      return null;
    } catch (error) {
      this.logger.error(`Error buscando URL de descarga: ${error.message}`);
      return null;
    }
  }

  private async descargarExcelDesdePortalConReintentos(
    fechaStr: string,
  ): Promise<Buffer | null> {
    /**
     * Descarga el archivo Excel del portal con reintentos y backoff.
     * Renueva sesión si es necesario y devuelve un `Buffer` con el contenido.
     * @param fechaStr Fecha en formato `YYYY-MM-DD`.
     */
    let intento = 0;
    let ultimoError: Error | null = null;

    while (intento < this.MAX_REINTENTOS) {
      intento++;
      this.logger.log(
        `Intento ${intento}/${this.MAX_REINTENTOS} para descargar Excel de fecha ${fechaStr}`,
      );

      try {
        if (!this.sessionCookies) {
          this.logger.log('No hay sesion activa, autenticando...');
          await this.autenticarPortal();
        }

        const urlDescarga = await this.obtenerUrlDescargaExcel(fechaStr);
        if (!urlDescarga) {
          this.logger.warn(
            `Intento ${intento}: No se encontró URL para fecha ${fechaStr}`,
          );

          if (intento < this.MAX_REINTENTOS) {
            this.logger.log(
              `Esperando ${this.INTERVALO_REINTENTO / 60000} minutos antes del siguiente intento...`,
            );
            await this.sleep(this.INTERVALO_REINTENTO);
            this.sessionCookies = '';
            continue;
          }
          return null;
        }

        this.logger.log(`Descargando archivo: ${urlDescarga}`);

        const response = await fetch(urlDescarga, {
          method: 'GET',
          headers: {
            Cookie: this.sessionCookies,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!response.ok) {
          throw new Error(
            `Error en descarga: ${response.status} ${response.statusText}`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
          this.logger.warn(
            `Intento ${intento}: Archivo descargado vacio para fecha ${fechaStr}`,
          );
          if (intento < this.MAX_REINTENTOS) {
            this.logger.log(
              `Esperando ${this.INTERVALO_REINTENTO / 60000} minutos antes del siguiente intento...`,
            );
            await this.sleep(this.INTERVALO_REINTENTO);
            continue;
          }
          return null;
        }

        this.logger.log(
          `Archivo descargado correctamente en intento ${intento}: ${buffer.length} bytes`,
        );
        return buffer;
      } catch (error) {
        ultimoError = error;
        this.logger.error(
          `Intento ${intento}/${this.MAX_REINTENTOS} fallido: ${error.message}`,
        );

        if (error.message.includes('401') || error.message.includes('403')) {
          this.logger.log('Reintentando autenticacion...');
          this.sessionCookies = '';
          try {
            await this.autenticarPortal();
          } catch (authError) {
            this.logger.error(`Error en autenticacion: ${authError.message}`);
          }
        }

        if (intento < this.MAX_REINTENTOS) {
          this.logger.log(
            `Esperando ${this.INTERVALO_REINTENTO / 60000} minutos antes del siguiente intento...`,
          );
          await this.sleep(this.INTERVALO_REINTENTO);
        }
      }
    }

    this.logger.error(
      `Todos los ${this.MAX_REINTENTOS} intentos fallaron para fecha ${fechaStr}`,
    );
    throw new Error(
      `Fallo al descargar Excel despues de ${this.MAX_REINTENTOS} intentos: ${ultimoError?.message}`,
    );
  }

  private transformarDatosExcel(data: any[], fechaStr: string): any[] {
    /**
     * Transforma las filas del Excel en el formato estandarizado que se
     * inserta en la tabla `reporte_inbound`.
     * Normaliza fechas, limpia cadenas y mapea campos.
     * @param data Filas tal como vienen del Excel.
     * @param fechaStr Fecha esperada en formato `YYYY-MM-DD`.
     */
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
          }
        } else if (typeof fechaCompleta === 'number') {
          const fecha = new Date((fechaCompleta - 25569) * 86400 * 1000);
          const añoUTC = fecha.getUTCFullYear();
          const mesUTC = (fecha.getUTCMonth() + 1).toString().padStart(2, '0');
          const diaUTC = fecha.getUTCDate().toString().padStart(2, '0');
          fechaISO = `${añoUTC}-${mesUTC}-${diaUTC}`;
          horaSolo = `${fecha.getUTCHours().toString().padStart(2, '0')}:${fecha.getUTCMinutes().toString().padStart(2, '0')}`;
        } else if (fechaCompleta instanceof Date) {
          const añoUTC = fechaCompleta.getUTCFullYear();
          const mesUTC = (fechaCompleta.getUTCMonth() + 1)
            .toString()
            .padStart(2, '0');
          const diaUTC = fechaCompleta.getUTCDate().toString().padStart(2, '0');
          fechaISO = `${añoUTC}-${mesUTC}-${diaUTC}`;
          horaSolo = `${fechaCompleta.getUTCHours().toString().padStart(2, '0')}:${fechaCompleta.getUTCMinutes().toString().padStart(2, '0')}`;
        }
      }

      if (fechaISO && fechaStr) {
        const [año, mes, dia] = fechaISO.split('-');
        const [diaEsperado, mesEsperado, añoEsperado] = fechaStr.split('-');

        if (parseInt(mes) > 12 && parseInt(dia) <= 12) {
          this.logger.warn(
            `Fecha invertida detectada: ${fechaISO}, corrigiendo...`,
          );
          fechaISO = `${año}-${dia}-${mes}`;
        }

        if (año !== añoEsperado || mes !== mesEsperado || dia !== diaEsperado) {
          this.logger.warn(
            `Fecha no coincide: Esperada ${añoEsperado}-${mesEsperado}-${diaEsperado}, Obtenida ${fechaISO}, forzando...`,
          );
          fechaISO = `${añoEsperado}-${mesEsperado}-${diaEsperado}`;
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
        fuente: 'EXCEL_PORTAL',
      });
    }

    return datosTransformados;
  }

  private async obtenerDatosExcelDesdePortal(fechaStr: string): Promise<any[]> {
    /**
     * Orquesta la descarga y lectura del Excel desde el portal, aplicando
     * transformación de los datos y devolviendo un arreglo estandarizado.
     * @param fechaStr Fecha en formato `YYYY-MM-DD`.
     */
    try {
      const buffer =
        await this.descargarExcelDesdePortalConReintentos(fechaStr);

      if (!buffer) {
        this.logger.warn(
          `No se pudo descargar el Excel para fecha ${fechaStr} despues de ${this.MAX_REINTENTOS} intentos`,
        );
        return [];
      }

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

      this.logger.log(`Registros leidos del Excel: ${data.length}`);

      if (data.length === 0) {
        this.logger.warn(`El Excel esta vacio para fecha ${fechaStr}`);
        return [];
      }

      const datosTransformados = this.transformarDatosExcel(data, fechaStr);

      this.logger.log(
        `Registros transformados del Excel: ${datosTransformados.length}`,
      );
      return datosTransformados;
    } catch (error) {
      this.logger.error(
        `Error en obtenerDatosExcelDesdePortal: ${error.message}`,
      );
      return [];
    }
  }

  private async obtenerDatosSQL(fechaStr: string): Promise<any[]> {
    /**
     * Consulta la base de datos origen (RepInCallsDetail) para la fecha
     * indicada y transforma el resultado al formato interno.
     * @param fechaStr Fecha en formato `YYYY-MM-DD`.
     */
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
    /**
     * Combina registros provenientes del Excel y de SQL, eliminando
     * duplicados prioritizando el `ID_LLAMADA` y preservando registros sin ID.
     */
    const mapa = new Map();
    const registrosSinID: any[] = [];

    this.logger.log(`Iniciando deduplicacion`);
    this.logger.log(`Registros Excel: ${datosExcel.length}`);
    this.logger.log(`Registros SQL: ${datosSQL.length}`);

    for (const dato of datosExcel) {
      if (!dato.ID_LLAMADA) {
        registrosSinID.push(dato);
        continue;
      }
      if (!mapa.has(dato.ID_LLAMADA)) {
        mapa.set(dato.ID_LLAMADA, dato);
      }
    }

    for (const dato of datosSQL) {
      if (!dato.ID_LLAMADA) {
        registrosSinID.push(dato);
        continue;
      }
      if (!mapa.has(dato.ID_LLAMADA)) {
        mapa.set(dato.ID_LLAMADA, dato);
      }
    }

    const resultado = [...Array.from(mapa.values()), ...registrosSinID];
    this.logger.log(`Total registros a insertar: ${resultado.length}`);
    return resultado;
  }

  private async insertarDatosEnTabla(
    datos: any[],
    fechaStr: string,
  ): Promise<{ insertados: number; errores: number }> {
    /**
     * Inserta los registros en la tabla destino `reporte_inbound`.
     * Realiza inserciones parametrizadas y cuenta insertados/errores.
     * @param datos Arreglo de registros transformados.
     * @param fechaStr Fecha en formato `YYYY-MM-DD`.
     */
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
    /**
     * Realiza el procesamiento completo combinando datos desde el portal
     * (Excel) y desde la base de datos SQL, deduplicando e insertando.
     * Devuelve un objeto con métricas del procesamiento.
     * @param fechaStr Fecha en formato `YYYY-MM-DD`.
     */
    this.logger.log(`Procesando reporte para fecha: ${fechaStr}`);

    try {
      const datosExcel = await this.obtenerDatosExcelDesdePortal(fechaStr);
      const datosSQL = await this.obtenerDatosSQL(fechaStr);

      this.logger.log(`Excel: ${datosExcel.length} registros`);
      this.logger.log(`SQL: ${datosSQL.length} registros`);

      const datosCombinados = this.combinarYLimpiarDuplicados(
        datosExcel,
        datosSQL,
      );
      const duplicadosEliminados =
        datosExcel.length + datosSQL.length - datosCombinados.length;

      this.logger.log(`Duplicados eliminados: ${duplicadosEliminados}`);
      this.logger.log(`Total a insertar: ${datosCombinados.length}`);

      const resultadoInsercion = await this.insertarDatosEnTabla(
        datosCombinados,
        fechaStr,
      );

      this.logger.log(`Procesamiento completado`);
      this.logger.log(`Insertados: ${resultadoInsercion.insertados}`);
      this.logger.log(`Errores: ${resultadoInsercion.errores}`);

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

  async procesarReporteAyerConReintentos() {
    /**
     * Ejecuta el procesamiento del reporte del día anterior con reintentos
     * y backoff. Renueva sesión y reintenta en caso de fallo.
     */
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const fechaStr = `${String(ayer.getDate()).padStart(2, '0')}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${ayer.getFullYear()}`;

    let intento = 0;
    let ultimoError: Error | null = null;

    this.logger.log(
      `Iniciando procesamiento de reporte para fecha ${fechaStr} con ${this.MAX_REINTENTOS} reintentos`,
    );

    while (intento < this.MAX_REINTENTOS) {
      intento++;
      this.logger.log(
        `Intento ${intento}/${this.MAX_REINTENTOS} para fecha ${fechaStr}`,
      );

      try {
        const resultado = await this.procesarAmbasFuentesCombinadas(fechaStr);
        if (resultado.exitoso) {
          this.logger.log(
            `Procesamiento exitoso en intento ${intento} para fecha ${fechaStr}`,
          );
          return resultado;
        }
        throw new Error(`Procesamiento fallido: ${JSON.stringify(resultado)}`);
      } catch (error) {
        ultimoError = error;
        this.logger.error(
          `Intento ${intento}/${this.MAX_REINTENTOS} fallido: ${error.message}`,
        );

        if (intento < this.MAX_REINTENTOS) {
          this.logger.log(
            `Esperando ${this.INTERVALO_REINTENTO / 60000} minutos antes del siguiente intento...`,
          );
          await this.sleep(this.INTERVALO_REINTENTO);

          // Renovar sesión en cada reintento
          try {
            await this.autenticarPortal();
            this.logger.log('Sesion renovada para reintento');
          } catch (authError) {
            this.logger.warn(`Error renovando sesion: ${authError.message}`);
          }
        }
      }
    }

    this.logger.error(
      `Todos los ${this.MAX_REINTENTOS} intentos fallaron para fecha ${fechaStr}`,
    );
    throw new Error(
      `Fallo al procesar reporte despues de ${this.MAX_REINTENTOS} intentos: ${ultimoError?.message}`,
    );
  }

  async procesarReporteAyer() {
    return this.procesarReporteAyerConReintentos();
  }

  async procesarFechaEspecifica(fechaStr: string) {
    let intento = 0;
    let ultimoError: Error | null = null;

    this.logger.log(
      `Procesando fecha especifica ${fechaStr} con ${this.MAX_REINTENTOS} reintentos`,
    );

    while (intento < this.MAX_REINTENTOS) {
      intento++;
      this.logger.log(
        `Intento ${intento}/${this.MAX_REINTENTOS} para fecha ${fechaStr}`,
      );

      try {
        const resultado = await this.procesarAmbasFuentesCombinadas(fechaStr);
        if (resultado.exitoso) {
          this.logger.log(
            `Procesamiento exitoso en intento ${intento} para fecha ${fechaStr}`,
          );
          return resultado;
        }
        throw new Error(`Procesamiento fallido: ${JSON.stringify(resultado)}`);
      } catch (error) {
        ultimoError = error;
        this.logger.error(
          `Intento ${intento}/${this.MAX_REINTENTOS} fallido: ${error.message}`,
        );

        if (intento < this.MAX_REINTENTOS) {
          this.logger.log(
            `Esperando ${this.INTERVALO_REINTENTO / 60000} minutos antes del siguiente intento...`,
          );
          await this.sleep(this.INTERVALO_REINTENTO);

          try {
            await this.autenticarPortal();
            this.logger.log('Sesion renovada para reintento');
          } catch (authError) {
            this.logger.warn(`Error renovando sesion: ${authError.message}`);
          }
        }
      }
    }

    this.logger.error(
      `Todos los ${this.MAX_REINTENTOS} intentos fallaron para fecha ${fechaStr}`,
    );
    throw new Error(
      `Fallo al procesar fecha especifica despues de ${this.MAX_REINTENTOS} intentos: ${ultimoError?.message}`,
    );
  }

  async corregirTextos(fechaStr: string) {
    return this.corregirTextosEnTabla(fechaStr);
  }

  async procesarReporteExcel(fechaStr: string) {
    const datos = await this.obtenerDatosExcelDesdePortal(fechaStr);
    const resultado = await this.insertarDatosEnTabla(datos, fechaStr);
    return {
      insertados: resultado.insertados,
      errores: resultado.errores,
      mensaje: 'Excel procesado desde portal',
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

      connectionOrigen = await sql.connect(this.getDbConfigOrigen());

      const result = await connectionOrigen
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

      return {
        fecha: fechaStr,
        totalRegistros: result.recordset[0].total,
      };
    } catch (error) {
      this.logger.error(`Error en diagnostico: ${error.message}`);
      return null;
    } finally {
      if (connectionOrigen) connectionOrigen.close();
    }
  }

  async probarAutenticacionPortal() {
    try {
      await this.autenticarPortal();
      return {
        success: true,
        message: 'Autenticacion exitosa en portal Nuxiba',
        cookies: this.sessionCookies ? 'Cookies obtenidas' : 'Sin cookies',
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en autenticacion: ${error.message}`,
      };
    }
  }

  async probarDescargaExcel(fechaStr: string) {
    try {
      const buffer =
        await this.descargarExcelDesdePortalConReintentos(fechaStr);
      if (buffer) {
        return {
          success: true,
          message: `Excel descargado correctamente: ${buffer.length} bytes`,
          size: buffer.length,
        };
      } else {
        return {
          success: false,
          message: `No se pudo descargar el Excel para fecha ${fechaStr} despues de ${this.MAX_REINTENTOS} intentos`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error en descarga: ${error.message}`,
      };
    }
  }

  async listarArchivosDisponibles(): Promise<any> {
    try {
      if (!this.sessionCookies) {
        await this.autenticarPortal();
      }

      const response = await fetch(`${this.PORTAL_BASE_URL}/Home/Index`, {
        method: 'GET',
        headers: {
          Cookie: this.sessionCookies,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const html = await response.text();
      const archivos: { nombre: string; fecha: string; url: string }[] = [];

      const rowRegex =
        /<tr[^>]*class="[^"]*animate-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
      let match;

      while ((match = rowRegex.exec(html)) !== null) {
        const rowContent = match[1];

        const nameMatch = rowContent.match(
          /<span[^>]*class="[^"]*file-name[^"]*"[^>]*>([^<]+)<\/span>/i,
        );
        const fileName = nameMatch ? nameMatch[1].trim() : null;

        const linkMatch = rowContent.match(
          /<a[^>]*class="[^"]*download-btn[^"]*"[^>]*href="([^"]*)"[^>]*>/i,
        );
        let url = linkMatch ? linkMatch[1] : null;

        if (fileName && fileName.startsWith('ReporteInbound_')) {
          if (url) {
            if (url.startsWith('/sitioreportes/sitioreportes')) {
              url = url.replace(
                '/sitioreportes/sitioreportes',
                '/sitioreportes',
              );
            }
            url = url.startsWith('http')
              ? url
              : `${this.PORTAL_BASE_URL}${url}`;
            if (url.includes('/sitioreportes/sitioreportes')) {
              url = url.replace(
                '/sitioreportes/sitioreportes',
                '/sitioreportes',
              );
            }
          }

          const fechaMatch = fileName.match(
            /ReporteInbound_(\d{4}-\d{2}-\d{2})\.xls/,
          );
          archivos.push({
            nombre: fileName,
            fecha: fechaMatch ? fechaMatch[1] : 'desconocida',
            url: url || 'no disponible',
          });
        }
      }

      return {
        success: true,
        total: archivos.length,
        archivos: archivos.slice(0, 20),
        ultimos: archivos.slice(-10),
        todosLosNombres: archivos.map((a) => a.nombre),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
