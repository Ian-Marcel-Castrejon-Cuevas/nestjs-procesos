import { Page } from 'playwright';
import { ReportLoggerService } from '../services/logger.service';
import { DateUtils } from '../utils/date.utils';
import { TIME_CONFIG, TIMEOUT_CONFIG } from '../constants/report.constants';

export interface StrategyConfig {
  type: string;
  searchText: string;
  filenamePrefix: string;
}

export abstract class BaseReportStrategy {
  protected yesterday: Date;

  constructor(
    protected config: StrategyConfig,
    protected logger: ReportLoggerService,
  ) {
    this.yesterday = DateUtils.getYesterday();
  }

  abstract execute(page: Page): Promise<string>;

  protected async login(page: Page): Promise<void> {
    const reminderUrl = process.env.REMINDER_URL;
    const reminderUser = process.env.REMINDER_USER;
    const reminderPass = process.env.REMINDER_PASS;

    if (!reminderUrl || !reminderUser || !reminderPass) {
      throw new Error('Missing Reminder credentials in environment variables');
    }

    await page.goto(reminderUrl);
    await page.waitForSelector('input[name="user"]', { timeout: 15000 });
    await page.fill('input[name="user"]', reminderUser);
    await page.fill('input[name="TxtUserPass"]', reminderPass);
    await page.click('#login-button');
    await page.waitForLoadState('networkidle');
  }

  protected async searchAndSelectCampaign(page: Page): Promise<void> {
    const searchInput = page.locator(
      '//input[@type="search" and contains(@class,"form-control")]',
    );
    await searchInput.waitFor({ state: 'visible', timeout: 15000 });
    await searchInput.click();
    await searchInput.fill(this.config.searchText);

    await page.waitForTimeout(2000);

    const card = page.locator(
      `//div[contains(@class,"cs-customer-card-center-panel") and .//p[text()="${this.config.searchText}"]]`,
    );
    await card.waitFor({ state: 'visible', timeout: 10000 });
    await card.scrollIntoViewIfNeeded();
    await card.click();
  }

  protected async navigateToReports(page: Page): Promise<void> {
    const reportsLink = page.locator(
      '//a[contains(@class,"nav-link") and .//label[text()="Reportes"]]',
    );
    await reportsLink.waitFor({ state: 'visible', timeout: 15000 });
    await reportsLink.scrollIntoViewIfNeeded();
    await reportsLink.click();

    await page.waitForSelector('.sidebar-toggle', { timeout: 10000 });
    await page.locator('.sidebar-toggle').first().click();
    await page.waitForTimeout(TIMEOUT_CONFIG.PAGE_LOAD_WAIT_MS);
  }

  protected async configureDateAndTime(page: Page): Promise<void> {
    const fechaAyer = this.yesterday;
    const diaAyer = fechaAyer.getDate();
    const mesAyer = fechaAyer.getMonth();
    const anioAyer = fechaAyer.getFullYear();

    await page.waitForSelector(
      '//button[contains(@class,"btn btn-primary col-xs btn btn-secondary")]',
      { timeout: 15000 },
    );
    await page
      .locator(
        '//button[contains(@class,"btn btn-primary col-xs btn btn-secondary")]',
      )
      .click();
    await page.waitForSelector('.react-datepicker__current-month', {
      timeout: 10000,
    });

    let currentMonthYear = await page
      .locator('.react-datepicker__current-month')
      .first()
      .textContent();

    const meses = {
      0: 'enero',
      1: 'febrero',
      2: 'marzo',
      3: 'abril',
      4: 'mayo',
      5: 'junio',
      6: 'julio',
      7: 'agosto',
      8: 'septiembre',
      9: 'octubre',
      10: 'noviembre',
      11: 'diciembre',
    };

    const targetMonth = meses[mesAyer];
    const targetMonthYear = `${targetMonth} ${anioAyer}`;

    let maxAttempts = 24;
    while (
      currentMonthYear &&
      !currentMonthYear.toLowerCase().includes(targetMonth) &&
      maxAttempts > 0
    ) {
      await page
        .locator(
          '.react-datepicker__navigation.react-datepicker__navigation--previous',
        )
        .click();
      await page.waitForTimeout(500);
      currentMonthYear = await page
        .locator('.react-datepicker__current-month')
        .first()
        .textContent();
      maxAttempts--;
    }

    await page.waitForTimeout(1000);

    const dayXPath = `//div[@role="listbox"]//div[contains(@class,"react-datepicker__day") and text()="${diaAyer}" and not(contains(@class,"outside-month")) and not(contains(@class,"disabled"))]`;

    try {
      await page.waitForSelector(dayXPath, { timeout: 10000 });

      const dayElement = page.locator(dayXPath).first();
      await dayElement.click();
      await page.waitForTimeout(1000);
    } catch (error) {
      this.logger.error(
        `No se pudo seleccionar el día ${diaAyer}: ${error.message}`,
      );
      throw error;
    }

    await this.configureTimePicker(page);
  }

  private async configureTimePicker(page: Page): Promise<void> {
    try {
      const fechaStr = this.yesterday.toLocaleDateString('es-MX');

      const startTimepicker = page.locator('.ss-timepicker-text-box').first();
      await startTimepicker.click({ timeout: 5000 });
      await page.waitForTimeout(500);

      const hoursInput = page
        .locator('.ss-timepicker-select.hours input')
        .first();
      await hoursInput.click();
      await hoursInput.fill('00');

      const minutesInput = page
        .locator('.ss-timepicker-select.minutes input')
        .first();
      await minutesInput.click();
      await minutesInput.fill('00');

      const startAmpm = page
        .locator('.ss-timepicker-select.ampm input')
        .first();
      const currentStartAmpm = await startAmpm.inputValue();

      if (currentStartAmpm !== 'AM') {
        const downButton = page
          .locator('.ss-timepicker-select.ampm button')
          .nth(1);
        await downButton.click();
      }

      const endTimepicker = page.locator('.ss-timepicker-text-box').nth(1);
      await endTimepicker.click({ timeout: 5000 });
      await page.waitForTimeout(500);

      const endHoursInput = page
        .locator('.ss-timepicker-select.hours input')
        .nth(1);
      await endHoursInput.click();
      await endHoursInput.fill('23');

      const endMinutesInput = page
        .locator('.ss-timepicker-select.minutes input')
        .nth(1);
      await endMinutesInput.click();
      await endMinutesInput.fill('59');

      const endAmpm = page.locator('.ss-timepicker-select.ampm input').nth(1);
      const currentEndAmpm = await endAmpm.inputValue();

      if (currentEndAmpm !== 'PM') {
        const upButton = page
          .locator('.ss-timepicker-select.ampm button')
          .nth(2);
        await upButton.click();
      }

      const finalStartHour = await page
        .locator('.ss-timepicker-select.hours input')
        .first()
        .inputValue();
      const finalStartMinute = await page
        .locator('.ss-timepicker-select.minutes input')
        .first()
        .inputValue();
      const finalStartAmpm = await page
        .locator('.ss-timepicker-select.ampm input')
        .first()
        .inputValue();
      const finalEndHour = await page
        .locator('.ss-timepicker-select.hours input')
        .nth(1)
        .inputValue();
      const finalEndMinute = await page
        .locator('.ss-timepicker-select.minutes input')
        .nth(1)
        .inputValue();
      const finalEndAmpm = await page
        .locator('.ss-timepicker-select.ampm input')
        .nth(1)
        .inputValue();

      await page.click('#applyDates');
      await page.waitForTimeout(3000);
    } catch (error) {
      this.logger.error(`Error configurando hora: ${error.message}`);
      throw error;
    }
  }

  protected async downloadReport(
    page: Page,
    filename: string,
  ): Promise<Buffer> {
    await page.waitForSelector('button.btn.btn-primary.btn.btn-secondary', {
      timeout: 15000,
    });

    const buttonText = await page
      .locator('button.btn.btn-primary.btn.btn-secondary')
      .nth(1)
      .textContent();

    if (buttonText && buttonText.includes('(0)')) {
      this.logger.warn(
        `No hay datos para generar el reporte ${this.config.type}`,
      );
      throw new Error('NO_DATA_AVAILABLE');
    }

    await page.getByRole('button', { name: 'Generar reporte' }).click();
    await page.waitForSelector('#btn-download', {
      timeout: TIMEOUT_CONFIG.DOWNLOAD_WAIT_MS,
    });

    const downloadPromise = page.waitForEvent('download', {
      timeout: TIMEOUT_CONFIG.DOWNLOAD_TIMEOUT_MS,
    });
    await page.click('#btn-download');
    const download = await downloadPromise;

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    return buffer;
  }

  protected async logout(page: Page): Promise<void> {
    try {
      await page.getByText('Cerrar sesión').click();
      await page.waitForTimeout(TIMEOUT_CONFIG.PAGE_LOAD_WAIT_MS);
    } catch (error) {
      this.logger.warn(`Error cerrando sesión: ${error.message}`);
    }
  }

  protected getFilename(): string {
    const dateStr = DateUtils.formatDateToFileName(this.yesterday);
    return `${this.config.filenamePrefix}_${dateStr}.xlsx`;
  }
}
