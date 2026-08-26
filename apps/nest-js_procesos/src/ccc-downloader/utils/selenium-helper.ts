import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webdriver from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SeleniumHelper {
  private readonly logger = new Logger(SeleniumHelper.name);
  private driver: webdriver.ThenableWebDriver | null = null;

  constructor(private configService: ConfigService) {}

  async crearDriver(
    rutaDescarga: string,
  ): Promise<webdriver.ThenableWebDriver> {
    const chromeOptions = new chrome.Options();

    const prefs = {
      'profile.default_content_setting_values.notifications': 2,
      'profile.block_third_party_cookies': true,
      'profile.default_content_setting_values.popups': 2,
      'profile.default_content_setting_values.media_stream': 2,
      'download.default_directory': rutaDescarga,
      'download.prompt_for_download': false,
      'download.directory_upgrade': true,
      'safebrowsing.enabled': true,
    };

    chromeOptions.setUserPreferences(prefs);
    chromeOptions.addArguments('--disable-notifications');
    chromeOptions.addArguments('--disable-popup-blocking');
    chromeOptions.addArguments('--disable-web-security');
    chromeOptions.addArguments('--disable-features=NotificationTriggers');

    // En producción, usar headless
    if (process.env.NODE_ENV === 'production') {
      chromeOptions.addArguments('--headless');
      chromeOptions.addArguments('--no-sandbox');
      chromeOptions.addArguments('--disable-dev-shm-usage');
    }

    const chromePath = this.configService.get('CHROME_PATH');
    if (chromePath) {
      chromeOptions.setChromeBinaryPath(chromePath);
    }

    // ✅ CORREGIDO: Usar new Builder() en lugar de webdriver.Builder.forBrowser
    this.driver = new webdriver.Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    await this.driver.manage().window().maximize();

    return this.driver;
  }

  async cerrarDriver(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.quit();
        this.logger.log('Driver cerrado correctamente');
      } catch (error: any) {
        this.logger.error(`Error al cerrar driver: ${error.message}`);
      }
      this.driver = null;
    }
  }

  getDriver(): webdriver.ThenableWebDriver | null {
    return this.driver;
  }

  async findElementSafe(
    by: webdriver.By,
    timeout: number = 20000,
  ): Promise<webdriver.WebElement | null> {
    if (!this.driver) return null;
    try {
      return await this.driver.wait(
        webdriver.until.elementLocated(by),
        timeout,
      );
    } catch (error: any) {
      return null;
    }
  }

  async waitForElementVisible(
    by: webdriver.By,
    timeout: number = 20000,
  ): Promise<webdriver.WebElement | null> {
    if (!this.driver) return null;
    try {
      const element = await this.driver.wait(
        webdriver.until.elementLocated(by),
        timeout,
      );
      await this.driver.wait(
        webdriver.until.elementIsVisible(element),
        timeout,
      );
      return element;
    } catch (error: any) {
      return null;
    }
  }

  async clickElementSafe(element: webdriver.WebElement): Promise<boolean> {
    try {
      await element.click();
      return true;
    } catch (error: any) {
      try {
        await this.driver?.executeScript('arguments[0].click();', element);
        return true;
      } catch (error2: any) {
        try {
          await this.driver?.executeScript(
            'arguments[0].scrollIntoView(true);',
            element,
          );
          await this.driver?.sleep(1000);
          await element.click();
          return true;
        } catch (error3: any) {
          return false;
        }
      }
    }
  }

  async esperarCargaHistorial(): Promise<boolean> {
    if (!this.driver) return false;

    const maxIntentos = 30;
    for (let intento = 0; intento < maxIntentos; intento++) {
      try {
        const statusElement = await this.findElementSafe(
          webdriver.By.id('divBackgridStatusText-CallRecord'),
          5000,
        );

        if (!statusElement) {
          await this.driver.sleep(2000);
          continue;
        }

        const texto = await statusElement.getText();

        if (!texto || texto === 'Cargando ...' || texto.includes('Cargando')) {
          this.logger.debug(
            `Cargando... (intento ${intento + 1}/${maxIntentos})`,
          );
          await this.driver.sleep(2000);
          continue;
        }

        if (texto.includes('No se encontraron registros')) {
          this.logger.warn('No hay registros para procesar');
          return false;
        }

        if (texto.includes('registros encontrados')) {
          this.logger.log(`Carga completada: ${texto}`);
          return true;
        }

        return true;
      } catch (error: any) {
        await this.driver.sleep(2000);
      }
    }

    return false;
  }

  async esperarDescargaArchivo(
    rutaDescarga: string,
    tiempoMaximo: number = 600,
  ): Promise<string | null> {
    this.logger.log('Esperando archivo de descarga...');

    const inicio = Date.now();

    while (Date.now() - inicio < tiempoMaximo * 1000) {
      try {
        const archivos = fs.readdirSync(rutaDescarga);
        const archivosZip = archivos.filter(
          (f) => f.endsWith('.zip') && !f.endsWith('.crdownload'),
        );

        if (archivosZip.length > 0) {
          const archivoDescargado = archivosZip[0];
          const rutaCompleta = path.join(rutaDescarga, archivoDescargado);

          try {
            fs.accessSync(rutaCompleta, fs.constants.R_OK);
            this.logger.log(`Archivo descargado: ${archivoDescargado}`);
            return rutaCompleta;
          } catch (error: any) {
            this.logger.debug(`Archivo encontrado pero aún en uso...`);
          }
        }

        await this.driver?.sleep(10000);
      } catch (error: any) {
        this.logger.error(`Error al verificar archivo: ${error.message}`);
        await this.driver?.sleep(10000);
      }
    }

    this.logger.warn('Tiempo de espera agotado para la descarga');
    return null;
  }

  async cambiarAFramePrincipal(): Promise<void> {
    if (!this.driver) return;

    try {
      const frames = await this.driver.findElements(
        webdriver.By.tagName('frame'),
      );
      this.logger.log(`Se encontraron ${frames.length} frames`);

      if (frames.length >= 2) {
        await this.driver.switchTo().frame(frames[1]);
        this.logger.log('Cambiado al frame principal');
      } else if (frames.length > 0) {
        await this.driver.switchTo().frame(frames[0]);
        this.logger.log('Cambiado al primer frame');
      }
    } catch (error: any) {
      this.logger.warn(`Error al cambiar de frame: ${error.message}`);
    }
  }
}
