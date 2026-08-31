import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as webdriver from 'selenium-webdriver';
import * as fs from 'fs';
import * as path from 'path';
import * as mssql from 'mssql';
import { SeleniumHelper } from './utils/selenium-helper';
import { CsvProcessor } from './utils/csv-processor';
import {
  CuentaConfig,
  ResultadoProcesamiento,
  RegistroLlamada,
  CredencialesCCC,
} from './interfaces/ccc-downloader.interface';
import { ResumenProcesoDto } from './dto/ccc-downloader.dto';

@Injectable()
export class CccDownloaderService implements OnModuleDestroy {
  private readonly logger = new Logger(CccDownloaderService.name);
  private readonly credenciales: CredencialesCCC;
  private readonly cuentas: CuentaConfig[];
  private readonly rutaDescarga: string;
  private notificacionesBloqueadas = false;
  private pool: mssql.ConnectionPool | null = null;

  private readonly dbConfig: {
    server: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };

  constructor(
    private configService: ConfigService,
    private seleniumHelper: SeleniumHelper,
    private csvProcessor: CsvProcessor,
  ) {
    this.credenciales = {
      username: this.configService.get('CCC_USERNAME', 'IAN CUEVAS'),
      password: 'Asecon2026i#',
    };

    this.dbConfig = {
      server: this.configService.get('DB_HOST2', '192.168.28.35'),
      port: parseInt(this.configService.get('DB_PORT2', '1433')),
      user: this.configService.get('DB_USERNAME2', 'app_reporte_ccc'),
      password: this.configService.get(
        'DB_PASSWORD2',
        'TuContraseñaSegura123!',
      ),
      database: this.configService.get('DB_DATABASE2', 'CCC_HistorialLlamadas'),
    };

    this.logger.log(
      `📊 Configuración BD: ${this.dbConfig.server}:${this.dbConfig.port}/${this.dbConfig.database}`,
    );
    this.logger.log(`👤 Usuario BD: ${this.dbConfig.user}`);

    this.cuentas = [
      { id: '2625', nombre: 'CCC-ASECON-CMX-0001' },
      { id: '2626', nombre: 'CCC-ASECON-CMX-0002' },
      { id: '2627', nombre: 'CCC-ASECON-CMX-0003' },
      { id: '2628', nombre: 'CCC-ASECON-CMX-0004' },
      { id: '2995', nombre: 'CCC-ASECON-CMX-0007' },
      { id: '2996', nombre: 'CCC-ASECON-CMX-0008' },
      { id: '2997', nombre: 'CCC-ASECON-CMX-0009' },
      { id: '2998', nombre: 'CCC-ASECON-CMX-0010' },
      { id: '2999', nombre: 'CCC-ASECON-CMX-0011' },
    ];

    this.rutaDescarga = path.join(process.cwd(), 'descargas');
    if (!fs.existsSync(this.rutaDescarga)) {
      fs.mkdirSync(this.rutaDescarga, { recursive: true });
    }

    this.logger.log(`📁 Directorio descargas: ${this.rutaDescarga}`);
  }

  @Cron('0 2 * * *', {
    name: 'ccc_downloader_diario',
    timeZone: 'America/Mexico_City',
  })
  async ejecutarReporteDiario() {
    this.logger.log('🚀 Iniciando ejecución programada del descargador CCC');

    try {
      const fechaAyer = new Date();
      fechaAyer.setDate(fechaAyer.getDate() - 1);
      const fechaStr = fechaAyer.toISOString().split('T')[0];

      const resultado = await this.ejecutarProcesoCompleto(fechaStr);
      this.logger.log(
        `✅ Proceso completado: ${resultado.cuentasExitosas} exitosas, ${resultado.cuentasFallidas} fallidas`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error en ejecución programada: ${error.message}`,
        error.stack,
      );
    }
  }

  async ejecutarProcesoCompleto(fechaStr?: string): Promise<ResumenProcesoDto> {
    const fecha = fechaStr || this.obtenerFechaAyer();
    this.logger.log(`📅 Iniciando proceso completo para fecha: ${fecha}`);

    const inicio = new Date();
    const resultados: ResultadoProcesamiento[] = [];

    await this.conectarBaseDatos();

    for (const cuenta of this.cuentas) {
      try {
        const resultado = await this.procesarCuenta(cuenta, fecha);
        resultados.push(resultado);
        this.logger.log(
          `📊 Cuenta ${cuenta.nombre}: ${resultado.exitoso ? '✅ Exitosa' : '❌ Fallida'}`,
        );
      } catch (error: any) {
        this.logger.error(
          `❌ Error procesando cuenta ${cuenta.nombre}: ${error.message}`,
        );
        resultados.push({
          customerId: cuenta.id,
          nombreCuenta: cuenta.nombre,
          exitoso: false,
          error: error.message,
        });
      }

      if (this.cuentas.indexOf(cuenta) < this.cuentas.length - 1) {
        this.logger.log(
          '⏳ Esperando 10 segundos antes de la siguiente cuenta...',
        );
        await this.sleep(10000);
      }
    }

    const fin = new Date();
    const exitosos = resultados.filter((r) => r.exitoso);
    const fallidos = resultados.filter((r) => !r.exitoso);

    return {
      totalCuentas: this.cuentas.length,
      cuentasExitosas: exitosos.length,
      cuentasFallidas: fallidos.length,
      detalles: resultados,
      fechaInicio: inicio,
      fechaFin: fin,
    };
  }

  async ejecutarCuentaUnica(
    customerId: string,
    fechaStr?: string,
  ): Promise<ResultadoProcesamiento> {
    const fecha = fechaStr || this.obtenerFechaAyer();
    const cuenta = this.cuentas.find((c) => c.id === customerId);

    if (!cuenta) {
      throw new Error(`Cuenta ${customerId} no encontrada`);
    }

    await this.conectarBaseDatos();

    this.logger.log(
      `📅 Ejecutando cuenta única: ${cuenta.nombre} para fecha: ${fecha}`,
    );
    return await this.procesarCuenta(cuenta, fecha);
  }

  private async conectarBaseDatos(): Promise<void> {
    try {
      if (this.pool && this.pool.connected) {
        return;
      }

      this.logger.log('🔌 Conectando a SQL Server...');

      const config: mssql.config = {
        server: this.dbConfig.server,
        port: this.dbConfig.port,
        user: this.dbConfig.user,
        password: this.dbConfig.password,
        database: this.dbConfig.database,
        options: {
          encrypt: false,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        connectionTimeout: 30000,
        requestTimeout: 30000,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      };

      this.pool = await mssql.connect(config);
      this.logger.log(
        `✅ Conectado a SQL Server: ${this.dbConfig.server}/${this.dbConfig.database}`,
      );

      await this.crearTablaSiNoExiste();
    } catch (error: any) {
      this.logger.error(`❌ Error al conectar a SQL Server: ${error.message}`);
      throw error;
    }
  }

  private async crearTablaSiNoExiste(): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='HistorialLlamadas' AND xtype='U')
        CREATE TABLE HistorialLlamadas (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          Cta NVARCHAR(50),
          CallID NVARCHAR(100),
          Type NVARCHAR(100),
          Campaign NVARCHAR(200),
          Agent NVARCHAR(200),
          CallerID NVARCHAR(100),
          CalledNumber NVARCHAR(100),
          Destination NVARCHAR(200),
          AnswerState NVARCHAR(100),
          AMDStatus NVARCHAR(100),
          HangupReason NVARCHAR(200),
          HangupCode INT,
          HangupCodeSIP INT,
          DurationSeconds FLOAT,
          DurationMinutes FLOAT,
          BillTimeMinutes FLOAT,
          BillRate FLOAT,
          BillCost FLOAT,
          StartDateTime DATE,
          AnswerDateTime NVARCHAR(50),
          HangupDateTime NVARCHAR(50),
          [Lead ID] NVARCHAR(100),
          [List ID] NVARCHAR(100),
          Hora TIME
        )
      `);

      // Crear índices
      const indices = [
        'IX_HistorialLlamadas_Cta',
        'IX_HistorialLlamadas_StartDateTime',
        'IX_HistorialLlamadas_CallID',
        'IX_HistorialLlamadas_Agent',
      ];

      for (const index of indices) {
        try {
          await this.pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index}' AND object_id = OBJECT_ID('HistorialLlamadas'))
            CREATE INDEX ${index} ON HistorialLlamadas(${index.replace('IX_HistorialLlamadas_', '')})
          `);
        } catch (error: any) {
          // Índice ya existe o error
        }
      }

      this.logger.log(
        '✅ Tabla HistorialLlamadas verificada/creada correctamente',
      );
    } catch (error: any) {
      this.logger.error(`❌ Error al crear tabla: ${error.message}`);
    }
  }

  private async procesarCuenta(
    cuenta: CuentaConfig,
    fechaStr: string,
  ): Promise<ResultadoProcesamiento> {
    let driver: webdriver.ThenableWebDriver | null = null;

    try {
      this.logger.log(
        `============================================================`,
      );
      this.logger.log(`📞 PROCESANDO CUENTA: ${cuenta.nombre}`);
      this.logger.log(
        `============================================================`,
      );

      driver = await this.seleniumHelper.crearDriver(this.rutaDescarga);
      this.logger.log('🌐 Navegador iniciado correctamente');

      // 1. Login
      await this.loginCCC(driver);

      // 2. Cambiar cuenta
      const cuentaCambiada = await this.cambiarCuenta(driver, cuenta.id);
      if (!cuentaCambiada) {
        throw new Error(`No se pudo cambiar a la cuenta ${cuenta.nombre}`);
      }

      // 3. Ir a Historial
      await this.irAHistorial(driver);

      // 4. Esperar a que termine la búsqueda inicial del historial
      await this.seleniumHelper.esperarCargaHistorial();

      // 5. Quitar y validar el filtro antes de consultar el rango solicitado
      const filtroContestadaDesactivado =
        await this.quitarFiltroContestada(driver);
      if (!filtroContestadaDesactivado) {
        throw new Error('No se pudo desactivar el filtro de contestada');
      }

      // 6. Aplicar fechas antes de validar los resultados
      await this.aplicarFechas(driver, fechaStr);

      // 7. Validar la carga del rango solicitado
      const cargaOK = await this.seleniumHelper.esperarCargaHistorial();
      if (!cargaOK) {
        throw new Error('No hay registros en el historial');
      }

      // 7. Descargar historial
      await this.descargarHistorial(driver);

      // 8. Ir a descargas
      await this.irADescargas(driver);

      // 9. Esperar descarga completada
      const rutaZip = await this.esperarDescargaCompletada(driver);
      if (!rutaZip) {
        throw new Error('No se completó la descarga');
      }

      // 10. Procesar CSV
      const fechaFormateada = fechaStr.replace(/-/g, '');
      const nombreCuenta = cuenta.nombre.split('-')[3] || cuenta.id;
      const rutaCSV = await this.csvProcessor.descomprimirYProcesarCSV(
        rutaZip,
        this.rutaDescarga,
        { id: cuenta.id, nombre: nombreCuenta },
        fechaFormateada,
      );

      if (!rutaCSV) {
        throw new Error('No se pudo procesar el archivo CSV');
      }

      // 11. Insertar en BD
      const registros = await this.csvProcessor.leerCSVProcesado(rutaCSV);
      const insertados = await this.insertarEnBaseDatos(registros);

      if (registros.length > 0 && insertados === 0) {
        throw new Error(
          `No se pudo insertar ninguno de los ${registros.length} registros`,
        );
      }

      this.logger.log(
        `✅ Cuenta ${cuenta.nombre} procesada exitosamente - ${insertados} registros insertados`,
      );

      return {
        customerId: cuenta.id,
        nombreCuenta: cuenta.nombre,
        exitoso: true,
        registrosInsertados: insertados,
        archivoGenerado: rutaCSV,
      };
    } catch (error: any) {
      this.logger.error(
        `❌ Error procesando cuenta ${cuenta.nombre}: ${error.message}`,
      );
      return {
        customerId: cuenta.id,
        nombreCuenta: cuenta.nombre,
        exitoso: false,
        error: error.message,
      };
    } finally {
      if (driver) {
        await this.seleniumHelper.cerrarDriver();
      }
    }
  }

  private async loginCCC(driver: webdriver.ThenableWebDriver): Promise<void> {
    this.logger.log('🔐 Iniciando sesión en CCC.uno...');

    const loginUrl = this.configService.get(
      'CCC_LOGIN_URL',
      'https://app.ccc.uno/Login',
    );
    await driver.get(loginUrl);
    this.logger.log('📄 Página de login cargada');

    const usernameField = await this.seleniumHelper.findElementSafe(
      webdriver.By.id('username'),
    );
    if (!usernameField) {
      throw new Error('No se encontró el campo de usuario');
    }
    await usernameField.clear();
    await usernameField.sendKeys(this.credenciales.username);
    this.logger.log('👤 Usuario ingresado');

    const passwordField = await this.seleniumHelper.findElementSafe(
      webdriver.By.id('password'),
    );
    if (!passwordField) {
      throw new Error('No se encontró el campo de contraseña');
    }
    await passwordField.clear();
    await passwordField.sendKeys(this.credenciales.password);
    this.logger.log('🔑 Contraseña ingresada');

    const loginButton = await this.seleniumHelper.findElementSafe(
      webdriver.By.id('btnSave'),
    );
    if (!loginButton) {
      throw new Error('No se encontró el botón de login');
    }
    await driver.executeScript(
      'arguments[0].scrollIntoView(true);',
      loginButton,
    );
    await driver.sleep(1000);
    await loginButton.click();
    this.logger.log('📤 Enviando formulario de login...');

    // Esperar a que la página redirija después del login
    await driver.sleep(8000);

    if (!this.notificacionesBloqueadas) {
      this.logger.log(
        '🔕 Las notificaciones de escritorio han sido bloqueadas automáticamente.',
      );
      this.notificacionesBloqueadas = true;
    }
  }

  private async cambiarCuenta(
    driver: webdriver.ThenableWebDriver,
    customerId: string,
  ): Promise<boolean> {
    this.logger.log(`🔄 Seleccionando cuenta ${customerId}...`);

    try {
      // Esperar a que la página cargue
      await driver.sleep(5000);

      // Verificar si estamos en la página correcta
      const url = await driver.getCurrentUrl();
      this.logger.log(`📍 URL actual: ${url}`);

      // Si la URL no contiene CallRecord, navegar directamente
      if (!url.includes('CallRecord')) {
        this.logger.log('📊 Navegando a CallRecord...');
        await driver.get('https://app.ccc.uno/CallRecord');
        await driver.sleep(5000);
      }

      // MÉTODO 1: Buscar el selector tradicional
      try {
        const selectors = [
          webdriver.By.id('selGlobalCustomer'),
          webdriver.By.css('select[id*="Customer"]'),
          webdriver.By.css('select[id*="customer"]'),
          webdriver.By.css('select[name*="customer"]'),
          webdriver.By.xpath("//select[contains(@id, 'Customer')]"),
          webdriver.By.xpath("//select[contains(@class, 'customer')]"),
          webdriver.By.className('customer-select'),
          webdriver.By.className('client-select'),
          webdriver.By.css('.customer-select'),
          webdriver.By.css('.client-select'),
        ];

        let selectElement: webdriver.WebElement | null = null;

        for (const selector of selectors) {
          try {
            const elementos = await driver.findElements(selector);
            if (elementos.length > 0) {
              selectElement = elementos[0];
              this.logger.log(
                `✅ Selector encontrado con: ${selector.toString()}`,
              );
              break;
            }
          } catch (error: any) {
            // Continuar
          }
        }

        if (selectElement) {
          // Hacer scroll y click
          await driver.executeScript(
            'arguments[0].scrollIntoView({block: "center"});',
            selectElement,
          );
          await driver.sleep(1000);

          // Cambiar el valor usando JavaScript
          await driver.executeScript(
            `
            var select = arguments[0];
            var value = arguments[1];
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
          `,
            selectElement,
            customerId,
          );

          await driver.sleep(3000);

          // Verificar que el cambio se aplicó
          const currentValue = await selectElement.getAttribute('value');
          this.logger.log(`📊 Valor actual del select: ${currentValue}`);

          if (currentValue === customerId) {
            this.logger.log(`✅ Cuenta cambiada exitosamente a: ${customerId}`);
            return true;
          }

          this.logger.log(`✅ Cuenta cambiada a ${customerId} vía selector`);
          return true;
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ Método 1 falló: ${error.message}`);
      }

      // MÉTODO 2: Buscar cualquier select con opciones numéricas
      try {
        this.logger.log(
          '🔍 Buscando cualquier select con opciones numéricas...',
        );
        const allSelects = await driver.findElements(
          webdriver.By.tagName('select'),
        );
        this.logger.log(
          `🔍 Total de selects en la página: ${allSelects.length}`,
        );

        for (const select of allSelects) {
          try {
            const options = await select.findElements(
              webdriver.By.tagName('option'),
            );
            if (options.length > 1) {
              // Verificar si tiene opciones con valores numéricos
              let hasNumericOptions = false;
              for (const option of options) {
                const value = await option.getAttribute('value');
                if (value && /^\d+$/.test(value)) {
                  hasNumericOptions = true;
                  break;
                }
              }

              if (hasNumericOptions) {
                this.logger.log(
                  `✅ Encontrado select con ${options.length} opciones numéricas`,
                );

                // Verificar si tiene el customerId
                let tieneCustomerId = false;
                for (const option of options) {
                  const value = await option.getAttribute('value');
                  if (value === customerId) {
                    tieneCustomerId = true;
                    break;
                  }
                }

                if (tieneCustomerId) {
                  this.logger.log(
                    `✅ Select contiene el customerId ${customerId}`,
                  );
                  await driver.executeScript(
                    `
                    var select = arguments[0];
                    var value = arguments[1];
                    select.value = value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                  `,
                    select,
                    customerId,
                  );

                  await driver.sleep(3000);
                  this.logger.log(`✅ Cuenta cambiada a ${customerId}`);
                  return true;
                }
              }
            }
          } catch (error: any) {
            // Ignorar
          }
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ Método 2 falló: ${error.message}`);
      }

      // MÉTODO 3: Navegar directamente con el parámetro en la URL
      try {
        this.logger.log(
          `🔄 Intentando navegar directamente con cuenta ${customerId}...`,
        );
        await driver.get(
          `https://app.ccc.uno/CallRecord?customer=${customerId}`,
        );
        await driver.sleep(5000);

        const currentUrlDespues = await driver.getCurrentUrl();
        this.logger.log(`📍 URL después de navegación: ${currentUrlDespues}`);

        // Intentar también con Customer mayúscula
        if (
          !currentUrlDespues.includes(`customer=${customerId}`) &&
          !currentUrlDespues.includes(`Customer=${customerId}`)
        ) {
          await driver.get(
            `https://app.ccc.uno/CallRecord?Customer=${customerId}`,
          );
          await driver.sleep(3000);
        }

        this.logger.log(`✅ Navegación directa completada`);
        return true;
      } catch (error: any) {
        this.logger.warn(`⚠️ Método 3 falló: ${error.message}`);
      }

      // MÉTODO 4: Usar localStorage o sessionStorage
      try {
        this.logger.log(`🔄 Intentando cambiar cuenta vía localStorage...`);
        await driver.executeScript(
          `
          localStorage.setItem('selectedCustomer', arguments[0]);
          sessionStorage.setItem('selectedCustomer', arguments[0]);
        `,
          customerId,
        );

        await driver.sleep(2000);
        await driver.navigate().refresh();
        await driver.sleep(5000);

        this.logger.log(`✅ Cambio vía localStorage completado`);
        return true;
      } catch (error: any) {
        this.logger.warn(`⚠️ Método 4 falló: ${error.message}`);
      }

      this.logger.error('❌ No se pudo cambiar la cuenta por ningún método');

      // Mostrar información de depuración
      try {
        const bodyHTML = await driver
          .findElement(webdriver.By.tagName('body'))
          .getAttribute('innerHTML');
        this.logger.log(
          `📄 HTML del body (primeros 1000 chars): ${bodyHTML.substring(0, 1000)}`,
        );
      } catch (error: any) {
        // Ignorar
      }

      return false;
    } catch (error: any) {
      this.logger.error(`❌ Error en cambiarCuenta: ${error.message}`);
      return false;
    }
  }

  private async irAHistorial(
    driver: webdriver.ThenableWebDriver,
  ): Promise<void> {
    this.logger.log('📊 Navegando a Historial Llamadas...');

    const historialUrl = this.configService.get(
      'CCC_HISTORIAL_URL',
      'https://app.ccc.uno/CallRecord',
    );
    await driver.get(historialUrl);
    await driver.sleep(5000);
    this.logger.log('✅ Navegación completada');
  }

  private async quitarFiltroContestada(
    driver: webdriver.ThenableWebDriver,
  ): Promise<boolean> {
    this.logger.log('🔍 Quitando filtro de contestada...');

    try {
      const filtroSelector = webdriver.By.xpath(
        "//input[@type='checkbox' and @data-filter='cdrstatus_answer']",
      );
      const checkboxes = await driver.findElements(filtroSelector);

      for (const checkbox of checkboxes) {
        if (await checkbox.isSelected()) {
          const labels = await checkbox.findElements(
            webdriver.By.xpath('./ancestor::label[1]'),
          );
          const controlFiltro = labels[0] || checkbox;
          await this.seleniumHelper.clickElementSafe(controlFiltro);
          this.logger.log('✅ Filtro de contestada desactivado');
          await driver.sleep(1500);
          await this.seleniumHelper.esperarCargaHistorial();
        }
      }

      const limiteValidacion = Date.now() + 10000;
      let desactivado = false;

      while (Date.now() < limiteValidacion) {
        const filtrosActivos = await driver.findElements(filtroSelector);
        const estados = await Promise.all(
          filtrosActivos.map(async (checkbox) => {
            return driver.executeScript(
              `
                const checkbox = arguments[0];
                const label = checkbox.closest('label');
                return checkbox.checked || label?.classList.contains('active');
              `,
              checkbox,
            );
          }),
        );

        desactivado = filtrosActivos.length === 0 || !estados.some(Boolean);
        if (desactivado) break;
        await driver.sleep(500);
      }

      if (desactivado) {
        this.logger.log(
          '✅ Validación confirmada: filtro de contestada desactivado',
        );
      } else {
        this.logger.warn(
          '⚠️ Validación fallida: el filtro de contestada sigue activo',
        );
      }

      return desactivado;
    } catch (error: any) {
      this.logger.warn(
        '⚠️ No se encontró el filtro de contestada o ya estaba desactivado',
      );
      return false;
    }
  }

  private async aplicarFechas(
    driver: webdriver.ThenableWebDriver,
    fechaStr: string,
  ): Promise<void> {
    this.logger.log(
      `📅 Aplicando fechas: ${fechaStr} 00:00 a ${fechaStr} 23:59`,
    );

    try {
      await driver.sleep(2000);

      const campoFrom = await this.seleniumHelper.findElementSafe(
        webdriver.By.id('txtDateFilterFrom'),
      );
      const campoTo = await this.seleniumHelper.findElementSafe(
        webdriver.By.id('txtDateFilterTo'),
      );

      if (!campoFrom || !campoTo) {
        this.logger.warn('⚠️ No se encontraron los campos de fecha');
        return;
      }

      await driver.executeScript('arguments[0].click();', campoFrom);
      await driver.sleep(500);
      await campoFrom.clear();
      await driver.sleep(500);
      await campoFrom.sendKeys(`${fechaStr} 00:00`);
      await driver.sleep(1000);

      await driver.executeScript('arguments[0].click();', campoTo);
      await driver.sleep(500);
      await campoTo.clear();
      await driver.sleep(500);
      await campoTo.sendKeys(`${fechaStr} 23:59`);
      await driver.sleep(1000);

      this.logger.log(
        `✅ Fechas aplicadas: ${fechaStr} 00:00 a ${fechaStr} 23:59`,
      );

      try {
        const botonBuscar = await this.seleniumHelper.findElementSafe(
          webdriver.By.id('btnBackgridSearch-CallRecord'),
        );
        if (botonBuscar) {
          await this.seleniumHelper.clickElementSafe(botonBuscar);
          this.logger.log('🔍 Botón de buscar presionado');
          await driver.sleep(2000);
          await this.seleniumHelper.esperarCargaHistorial();
        }
      } catch (error: any) {
        await campoFrom.sendKeys(webdriver.Key.ENTER);
        this.logger.log('⌨️ Enter presionado en campo desde');
        await driver.sleep(2000);
        await this.seleniumHelper.esperarCargaHistorial();
      }
    } catch (error: any) {
      this.logger.error(`❌ Error al aplicar fechas: ${error.message}`);
    }
  }

  private async descargarHistorial(
    driver: webdriver.ThenableWebDriver,
  ): Promise<void> {
    this.logger.log('⬇️ Descargando historial de llamadas...');

    try {
      const botonDescargar = await this.seleniumHelper.findElementSafe(
        webdriver.By.id('icoDownload'),
      );
      if (botonDescargar) {
        await driver.executeScript('arguments[0].click();', botonDescargar);
        this.logger.log('✅ Botón Descargar presionado');
        await driver.sleep(2000);
      } else {
        throw new Error('No se encontró el botón Descargar');
      }

      const opcionHistorial = await this.seleniumHelper.findElementSafe(
        webdriver.By.id('btnCallHistoryDownload'),
      );
      if (opcionHistorial) {
        await this.seleniumHelper.clickElementSafe(opcionHistorial);
        this.logger.log('✅ Opción Historial Llamadas seleccionada');
      } else {
        throw new Error('No se encontró la opción Historial Llamadas');
      }

      this.logger.log('⏳ Esperando que cargue la ventana de Parámetros...');
      await driver.sleep(8000);

      // Cambiar al frame de contenido si existe
      try {
        await driver.switchTo().defaultContent();
        await driver.sleep(1000);
        const frames = await driver.findElements(webdriver.By.tagName('frame'));
        if (frames.length >= 2) {
          await driver.switchTo().frame(frames[1]);
          this.logger.log('✅ Cambiado al frame de contenido');
          await driver.sleep(2000);
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ Error al cambiar de frame: ${error.message}`);
      }

      // Desactivar checkbox de notificación
      try {
        const checkboxNotificacion = await driver.findElement(
          webdriver.By.id('chkEmailModalReportParams'),
        );
        if (await checkboxNotificacion.isSelected()) {
          await this.seleniumHelper.clickElementSafe(checkboxNotificacion);
          this.logger.log('✅ Checkbox de notificación desactivado');
        }
      } catch (error: any) {
        this.logger.warn('⚠️ No se encontró el checkbox de notificación');
      }

      // Activar checkbox de lista
      try {
        const checkboxLista = await driver.findElement(
          webdriver.By.id('checkAddListAndDispositions'),
        );
        if (!(await checkboxLista.isSelected())) {
          await this.seleniumHelper.clickElementSafe(checkboxLista);
          this.logger.log('✅ Checkbox de lista y disposiciones activado');
        }
      } catch (error: any) {
        this.logger.warn('⚠️ No se encontró el checkbox de lista');
      }

      // Botón Iniciar
      try {
        const botonIniciar = await driver.findElement(
          webdriver.By.xpath(
            "//button[contains(@class, 'btnSaveModalReportParams')]",
          ),
        );
        if (botonIniciar) {
          await driver.executeScript(
            'arguments[0].scrollIntoView({block: "center"});',
            botonIniciar,
          );
          await driver.sleep(1000);
          await this.seleniumHelper.clickElementSafe(botonIniciar);
          this.logger.log('✅ Botón Iniciar presionado');
          await driver.sleep(3000);
          this.logger.log('✅ Descarga de historial iniciada exitosamente');
        }
      } catch (error: any) {
        const botonIniciar = await driver.findElement(
          webdriver.By.xpath("//button[contains(text(), 'Iniciar')]"),
        );
        if (botonIniciar) {
          await this.seleniumHelper.clickElementSafe(botonIniciar);
          this.logger.log('✅ Botón Iniciar presionado (por texto)');
          await driver.sleep(3000);
          this.logger.log('✅ Descarga de historial iniciada exitosamente');
        } else {
          throw new Error('No se pudo encontrar el botón Iniciar');
        }
      }
    } catch (error: any) {
      throw new Error(`Error al descargar historial: ${error.message}`);
    }
  }

  private async irADescargas(
    driver: webdriver.ThenableWebDriver,
  ): Promise<void> {
    this.logger.log('📂 Navegando a la página de Descargas...');

    const descargasUrl = this.configService.get(
      'CCC_DESCARGAS_URL',
      'https://app.ccc.uno/Jobs',
    );
    await driver.get(descargasUrl);
    await driver.sleep(5000);

    try {
      const frames = await driver.findElements(webdriver.By.tagName('frame'));
      if (frames.length >= 2) {
        await driver.switchTo().frame(frames[1]);
        this.logger.log('✅ Cambiado al frame de contenido');
      } else if (frames.length >= 1) {
        await driver.switchTo().frame(frames[0]);
        this.logger.log('✅ Cambiado al frame principal');
      }
    } catch (error: any) {
      this.logger.warn(`⚠️ Error al cambiar de frame: ${error.message}`);
    }

    this.logger.log('✅ Página de descargas cargada correctamente');
  }

  private async esperarDescargaCompletada(
    driver: webdriver.ThenableWebDriver,
  ): Promise<string | null> {
    this.logger.log('⏳ Esperando a que la descarga se complete...');
    this.logger.log('⏱️ Tiempo máximo de espera: 10 minutos');

    const tiempoMaximo = 600;
    let tiempoEspera = 0;
    const intervalo = 10;

    while (tiempoEspera < tiempoMaximo) {
      try {
        try {
          const frames = await driver.findElements(
            webdriver.By.tagName('frame'),
          );
          if (frames.length >= 2) {
            await driver.switchTo().frame(frames[1]);
          } else if (frames.length >= 1) {
            await driver.switchTo().frame(frames[0]);
          }
        } catch (error: any) {
          // Ignorar errores de frame
        }

        try {
          const statusElement = await driver.findElement(
            webdriver.By.xpath(
              "//table[contains(@class, 'backgrid')]/tbody/tr[1]/td[contains(@class, 'backgridcell-align-center')]//span[contains(@class, 'label')]",
            ),
          );

          const statusText = await statusElement.getAttribute('data-content');

          if (statusText) {
            this.logger.log(
              `  📊 Estado actual: ${statusText} (tiempo: ${tiempoEspera}s)`,
            );

            if (statusText.toUpperCase().includes('COMPLETED')) {
              this.logger.log('✅ Descarga completada!');

              const enlaceDescarga = await driver.wait(
                webdriver.until.elementLocated(
                  webdriver.By.xpath(
                    "//table[contains(@class, 'backgrid')]/tbody/tr[1]//a[contains(@href, '/IncrementalDownload/Download')]",
                  ),
                ),
                15000,
              );

              await driver.executeScript(
                'arguments[0].scrollIntoView({block: "center"});',
                enlaceDescarga,
              );
              await driver.sleep(500);
              const hrefDescarga = await enlaceDescarga.getAttribute('href');
              await this.seleniumHelper.clickElementSafe(enlaceDescarga);
              this.logger.log(
                `⬇️ Enlace de descarga presionado: ${hrefDescarga}`,
              );

              const rutaZip = await this.seleniumHelper.esperarDescargaArchivo(
                this.rutaDescarga,
                600,
              );

              if (rutaZip) {
                this.logger.log('✅ Archivo descargado exitosamente');
                return rutaZip;
              }
            }

            if (statusText.toUpperCase().includes('ERROR')) {
              this.logger.error(`❌ Error en la descarga: ${statusText}`);
              return null;
            }
          }
        } catch (error: any) {
          // No hay status aún
        }

        await driver.sleep(intervalo * 1000);
        tiempoEspera += intervalo;
      } catch (error: any) {
        this.logger.error(`❌ Error en la espera: ${error.message}`);
        await driver.sleep(intervalo * 1000);
        tiempoEspera += intervalo;
      }
    }

    this.logger.log(`⏱️ Tiempo de espera agotado (${tiempoMaximo}s)`);
    return null;
  }

  private async insertarEnBaseDatos(
    registros: RegistroLlamada[],
  ): Promise<number> {
    if (!this.pool) {
      throw new Error('No hay conexión a la base de datos');
    }

    this.logger.log(
      `💾 Insertando ${registros.length} registros en la base de datos...`,
    );

    let insertados = 0;
    const batchSize = 1000;

    const query = `
      INSERT INTO HistorialLlamadas (
        Cta, CallID, Type, Campaign, Agent, CallerID, CalledNumber,
        Destination, AnswerState, AMDStatus, HangupReason,
        HangupCode, HangupCodeSIP, DurationSeconds, DurationMinutes,
        BillTimeMinutes, BillRate, BillCost, StartDateTime,
        AnswerDateTime, HangupDateTime, [Lead ID], [List ID], Hora
      ) VALUES (
        @Cta, @CallID, @Type, @Campaign, @Agent, @CallerID, @CalledNumber,
        @Destination, @AnswerState, @AMDStatus, @HangupReason,
        @HangupCode, @HangupCodeSIP, @DurationSeconds, @DurationMinutes,
        @BillTimeMinutes, @BillRate, @BillCost, @StartDateTime,
        @AnswerDateTime, @HangupDateTime, @LeadID, @ListID, @Hora
      )
    `;

    for (let i = 0; i < registros.length; i += batchSize) {
      const batch = registros.slice(i, i + batchSize);

      for (const registro of batch) {
        try {
          const request = this.pool.request();

          request.input('Cta', mssql.NVarChar, registro.Cta);
          request.input('CallID', mssql.NVarChar, registro.CallID);
          request.input('Type', mssql.NVarChar, registro.Type);
          request.input('Campaign', mssql.NVarChar, registro.Campaign);
          request.input('Agent', mssql.NVarChar, registro.Agent);
          request.input('CallerID', mssql.NVarChar, registro.CallerID);
          request.input('CalledNumber', mssql.NVarChar, registro.CalledNumber);
          request.input('Destination', mssql.NVarChar, registro.Destination);
          request.input('AnswerState', mssql.NVarChar, registro.AnswerState);
          request.input('AMDStatus', mssql.NVarChar, registro.AMDStatus);
          request.input('HangupReason', mssql.NVarChar, registro.HangupReason);
          request.input('HangupCode', mssql.Int, registro.HangupCode);
          request.input('HangupCodeSIP', mssql.Int, registro.HangupCodeSIP);
          request.input(
            'DurationSeconds',
            mssql.Float,
            registro.DurationSeconds,
          );
          request.input(
            'DurationMinutes',
            mssql.Float,
            registro.DurationMinutes,
          );
          request.input(
            'BillTimeMinutes',
            mssql.Float,
            registro.BillTimeMinutes,
          );
          request.input('BillRate', mssql.Float, registro.BillRate);
          request.input('BillCost', mssql.Float, registro.BillCost);
          request.input('StartDateTime', mssql.Date, registro.StartDateTime);
          request.input(
            'AnswerDateTime',
            mssql.NVarChar,
            registro.AnswerDateTime,
          );
          request.input(
            'HangupDateTime',
            mssql.NVarChar,
            registro.HangupDateTime,
          );
          request.input('LeadID', mssql.NVarChar, registro.LeadID);
          request.input('ListID', mssql.NVarChar, registro.ListID);
          request.input(
            'Hora',
            mssql.Time,
            this.convertirHoraParaSql(registro.Hora),
          );

          await request.query(query);
          insertados++;
        } catch (error: any) {
          this.logger.warn(`⚠️ Error insertando registro: ${error.message}`);
        }
      }

      this.logger.log(`📊 ${insertados} registros insertados...`);
    }

    this.logger.log(
      `✅ Total de registros insertados: ${insertados} de ${registros.length}`,
    );
    return insertados;
  }

  private obtenerFechaAyer(): string {
    const fechaAyer = new Date();
    fechaAyer.setDate(fechaAyer.getDate() - 1);
    return fechaAyer.toISOString().split('T')[0];
  }

  private convertirHoraParaSql(hora: string | null): Date | null {
    if (!hora) return null;

    const partes = hora.split(':').map(Number);
    if (
      partes.length !== 3 ||
      partes.some((parte) => !Number.isInteger(parte)) ||
      partes[0] < 0 ||
      partes[0] > 23 ||
      partes[1] < 0 ||
      partes[1] > 59 ||
      partes[2] < 0 ||
      partes[2] > 59
    ) {
      return null;
    }

    return new Date(1970, 0, 1, partes[0], partes[1], partes[2], 0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy() {
    this.logger.log('🔚 Cerrando recursos...');
    if (this.pool) {
      try {
        await this.pool.close();
        this.logger.log('✅ Conexión a SQL Server cerrada');
      } catch (error: any) {
        this.logger.error(`❌ Error al cerrar conexión: ${error.message}`);
      }
    }
    await this.seleniumHelper.cerrarDriver();
  }
}
