export class DateUtils {
  static getYesterday(): Date {
    const now = new Date();
    const mexicoTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }),
    );
    const yesterday = new Date(mexicoTime);
    yesterday.setDate(mexicoTime.getDate() - 1);

    return yesterday;
  }

  static formatDateToFileName(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}${month}${year}`;
  }

  static formatDateToDisplay(date: Date): string {
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  static getMonthYearFolder(date: Date): string {
    const months = {
      1: 'ENERO',
      2: 'FEBRERO',
      3: 'MARZO',
      4: 'ABRIL',
      5: 'MAYO',
      6: 'JUNIO',
      7: 'JULIO',
      8: 'AGOSTO',
      9: 'SEPTIEMBRE',
      10: 'OCTUBRE',
      11: 'NOVIEMBRE',
      12: 'DICIEMBRE',
    };
    return `${months[date.getMonth() + 1]} ${date.getFullYear()}`;
  }
}
