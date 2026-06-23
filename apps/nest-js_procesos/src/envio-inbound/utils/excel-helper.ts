import * as ExcelJS from 'exceljs';
import { LlamadaTransformadaDto } from '../dto/reporte-inbound.dto';
import { ChartApiHelper } from './chart-api-helper';

export class ExcelHelper {
  static async generarReporteExcel(
    data: LlamadaTransformadaDto[],
    fecha: Date,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const fechaStr = fecha.toISOString().split('T')[0];

    const areasPermitidas = ['BBVA', 'GMF', 'TOYOTA', 'AT&T'];

    const filteredData = data.filter((item) => {
      const areaValida = areasPermitidas.some((area) =>
        item.Area?.toUpperCase().includes(area.toUpperCase()),
      );
      const herramientaValida =
        !item.Med_Contacto?.toUpperCase().includes('OTRO');
      return areaValida && herramientaValida;
    });

    console.log(`Datos originales: ${data.length}`);
    console.log(`Datos filtrados: ${filteredData.length}`);

    const hojaResumen = workbook.addWorksheet('Datos de Abandono');

    hojaResumen.mergeCells('A1:E1');
    const titleCell = hojaResumen.getCell('A1');
    titleCell.value = `RESUMEN DE ABANDONO - ${fechaStr}`;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF2C3E50' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAD3' },
    };
    hojaResumen.getRow(1).height = 30;

    hojaResumen.mergeCells('A2:E2');
    const subtitleCell = hojaResumen.getCell('A2');
    subtitleCell.value = 'Reporte de llamadas Inbound por área y herramienta';
    subtitleCell.font = { size: 11, color: { argb: 'FF7F8C8D' } };
    subtitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' },
    };
    hojaResumen.getRow(2).height = 20;

    const headers = [
      'Resumen',
      'Atendida',
      'Abandonada',
      'Total general',
      '% Abandono',
    ];
    const headerRow = hojaResumen.addRow(headers);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3498DB' },
      };
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const resumen = this.procesarDatos(filteredData);

    let currentRow = 5;
    let totalGeneralAtendida = 0;
    let totalGeneralAbandonada = 0;
    let totalGeneralTotal = 0;

    const areasOrdenadas = ['AT&T', 'BBVA', 'BBVA_REF', 'GMF', 'TOYOTA'];

    for (const area of areasOrdenadas) {
      if (!resumen.has(area)) continue;

      const herramientas = resumen.get(area)!;
      const herramientasOrdenadas = Array.from(herramientas.keys()).sort();

      let totalAreaAtendida = 0;
      let totalAreaAbandonada = 0;
      let totalAreaTotal = 0;

      for (const herramienta of herramientasOrdenadas) {
        const stats = herramientas.get(herramienta)!;
        const porcentaje =
          stats.Total > 0 ? (stats.Abandonada / stats.Total) * 100 : 0;

        hojaResumen.getCell(`A${currentRow}`).value = herramienta;
        hojaResumen.getCell(`A${currentRow}`).font = { bold: true, size: 11 };
        hojaResumen.getCell(`A${currentRow}`).alignment = {
          horizontal: 'left',
          vertical: 'middle',
        };

        hojaResumen.getCell(`B${currentRow}`).value = stats.Atendida;
        hojaResumen.getCell(`B${currentRow}`).alignment = {
          horizontal: 'center',
        };
        hojaResumen.getCell(`B${currentRow}`).font = { size: 11 };

        hojaResumen.getCell(`C${currentRow}`).value = stats.Abandonada;
        hojaResumen.getCell(`C${currentRow}`).alignment = {
          horizontal: 'center',
        };
        hojaResumen.getCell(`C${currentRow}`).font = { size: 11 };

        hojaResumen.getCell(`D${currentRow}`).value = stats.Total;
        hojaResumen.getCell(`D${currentRow}`).alignment = {
          horizontal: 'center',
        };
        hojaResumen.getCell(`D${currentRow}`).font = { size: 11 };

        hojaResumen.getCell(`E${currentRow}`).value =
          `${porcentaje.toFixed(2)}%`;
        hojaResumen.getCell(`E${currentRow}`).alignment = {
          horizontal: 'center',
        };
        hojaResumen.getCell(`E${currentRow}`).font = { bold: true, size: 11 };
        hojaResumen.getCell(`E${currentRow}`).fill =
          this.getPorcentajeFill(porcentaje);

        totalAreaAtendida += stats.Atendida;
        totalAreaAbandonada += stats.Abandonada;
        totalAreaTotal += stats.Total;
        currentRow++;
      }

      const totalAreaPorcentaje =
        totalAreaTotal > 0 ? (totalAreaAbandonada / totalAreaTotal) * 100 : 0;

      hojaResumen.getCell(`A${currentRow}`).value = `Total ${area}`;
      hojaResumen.getCell(`A${currentRow}`).font = {
        bold: true,
        size: 11,
        color: { argb: 'FF2C3E50' },
      };
      hojaResumen.getCell(`A${currentRow}`).alignment = {
        horizontal: 'left',
        vertical: 'middle',
      };

      hojaResumen.getCell(`B${currentRow}`).value = totalAreaAtendida;
      hojaResumen.getCell(`B${currentRow}`).font = { bold: true };
      hojaResumen.getCell(`B${currentRow}`).alignment = {
        horizontal: 'center',
      };

      hojaResumen.getCell(`C${currentRow}`).value = totalAreaAbandonada;
      hojaResumen.getCell(`C${currentRow}`).font = { bold: true };
      hojaResumen.getCell(`C${currentRow}`).alignment = {
        horizontal: 'center',
      };

      hojaResumen.getCell(`D${currentRow}`).value = totalAreaTotal;
      hojaResumen.getCell(`D${currentRow}`).font = { bold: true };
      hojaResumen.getCell(`D${currentRow}`).alignment = {
        horizontal: 'center',
      };

      hojaResumen.getCell(`E${currentRow}`).value =
        `${totalAreaPorcentaje.toFixed(2)}%`;
      hojaResumen.getCell(`E${currentRow}`).font = { bold: true };
      hojaResumen.getCell(`E${currentRow}`).alignment = {
        horizontal: 'center',
      };
      hojaResumen.getCell(`E${currentRow}`).fill =
        this.getPorcentajeFill(totalAreaPorcentaje);

      for (let col = 1; col <= 4; col++) {
        const cell = hojaResumen.getCell(currentRow, col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF2CC' },
        };
      }

      totalGeneralAtendida += totalAreaAtendida;
      totalGeneralAbandonada += totalAreaAbandonada;
      totalGeneralTotal += totalAreaTotal;
      currentRow += 2;
    }

    const totalGeneralPorcentaje =
      totalGeneralTotal > 0
        ? (totalGeneralAbandonada / totalGeneralTotal) * 100
        : 0;

    hojaResumen.getCell(`A${currentRow}`).value = 'TOTAL GENERAL';
    hojaResumen.getCell(`A${currentRow}`).font = {
      bold: true,
      size: 12,
      color: { argb: 'FF000000' },
    };
    hojaResumen.getCell(`A${currentRow}`).alignment = {
      horizontal: 'left',
      vertical: 'middle',
    };

    hojaResumen.getCell(`B${currentRow}`).value = totalGeneralAtendida;
    hojaResumen.getCell(`B${currentRow}`).font = {
      bold: true,
      color: { argb: 'FF000000' },
    };
    hojaResumen.getCell(`B${currentRow}`).alignment = { horizontal: 'center' };

    hojaResumen.getCell(`C${currentRow}`).value = totalGeneralAbandonada;
    hojaResumen.getCell(`C${currentRow}`).font = {
      bold: true,
      color: { argb: 'FF000000' },
    };
    hojaResumen.getCell(`C${currentRow}`).alignment = { horizontal: 'center' };

    hojaResumen.getCell(`D${currentRow}`).value = totalGeneralTotal;
    hojaResumen.getCell(`D${currentRow}`).font = {
      bold: true,
      color: { argb: 'FF000000' },
    };
    hojaResumen.getCell(`D${currentRow}`).alignment = { horizontal: 'center' };

    hojaResumen.getCell(`E${currentRow}`).value =
      `${totalGeneralPorcentaje.toFixed(2)}%`;
    hojaResumen.getCell(`E${currentRow}`).font = {
      bold: true,
      size: 12,
      color: { argb: 'FF000000' },
    };
    hojaResumen.getCell(`E${currentRow}`).alignment = { horizontal: 'center' };
    hojaResumen.getCell(`E${currentRow}`).fill = this.getPorcentajeFill(
      totalGeneralPorcentaje,
    );

    for (let col = 1; col <= 4; col++) {
      const cell = hojaResumen.getCell(currentRow, col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF27AE60' },
      };
    }

    hojaResumen.getColumn(1).width = 30;
    hojaResumen.getColumn(2).width = 14;
    hojaResumen.getColumn(3).width = 14;
    hojaResumen.getColumn(4).width = 16;
    hojaResumen.getColumn(5).width = 18;

    const hojaGrafica = workbook.addWorksheet('Gráfica');

    try {
      const imageBuffer = await ChartApiHelper.generarGraficaComoImagen(
        filteredData,
        fechaStr,
      );

      const imageId = workbook.addImage({
        buffer: imageBuffer as any,
        extension: 'png',
      });

      hojaGrafica.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 1100, height: 550 },
      });

      hojaGrafica.getRow(1).height = 400;
      hojaGrafica.getColumn(1).width = 120;

      console.log('Gráfica generada exitosamente');
    } catch (error: any) {
      console.log('Error al generar gráfica:', error.message);
      hojaGrafica.getCell('A1').value = 'No se pudo generar la gráfica';
    }

    const hojaSQL = workbook.addWorksheet('Datos SQL');
    const sqlHeaders = [
      'Fecha',
      'Hora',
      'Campaña',
      'Estado_llamada',
      'Status',
      'Area',
      'Herramienta',
      'DID',
      'Origen',
      'Tiempo',
      'ID Llamada',
    ];
    const sqlHeaderRow = hojaSQL.addRow(sqlHeaders);
    sqlHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3498DB' },
      };
      cell.alignment = { horizontal: 'center' };
    });

    for (const item of filteredData) {
      hojaSQL.addRow([
        item.Fecha instanceof Date
          ? item.Fecha.toISOString().split('T')[0]
          : item.Fecha,
        item.Hora,
        item.Campaña,
        item.Estado_llamada,
        item.Status,
        item.Area,
        item.Med_Contacto,
        item.DID,
        item.Origen,
        item.Tiempo_llamada,
        item.Id_llamada,
      ]);
    }
    hojaSQL.columns.forEach((col) => (col.width = 15));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private static getPorcentajeFill(porcentaje: number): ExcelJS.Fill {
    let colorArgb: string;
    if (porcentaje > 51) colorArgb = 'FFFFC7CE';
    else if (porcentaje >= 30) colorArgb = 'FFFFEB9C';
    else colorArgb = 'FFC6EFCE';
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } };
  }

  private static procesarDatos(
    data: LlamadaTransformadaDto[],
  ): Map<
    string,
    Map<string, { Atendida: number; Abandonada: number; Total: number }>
  > {
    const resultado = new Map();
    data.forEach((item) => {
      let area = item.Area || 'Sin área';
      const herramienta = item.Med_Contacto || 'Sin herramienta';

      if (area.toUpperCase().includes('BBVA')) {
        area =
          area.includes('_REF') || area === 'BBVA_REF' ? 'BBVA_REF' : 'BBVA';
      } else if (area.toUpperCase().includes('GMF')) area = 'GMF';
      else if (area.toUpperCase().includes('TOYOTA')) area = 'TOYOTA';
      else if (
        area.toUpperCase().includes('ATT') ||
        area.toUpperCase().includes('AT&T')
      )
        area = 'AT&T';
      else return;

      if (!resultado.has(area)) resultado.set(area, new Map());
      const herramientas = resultado.get(area)!;
      if (!herramientas.has(herramienta))
        herramientas.set(herramienta, { Atendida: 0, Abandonada: 0, Total: 0 });

      const stats = herramientas.get(herramienta)!;
      stats.Total++;
      const esAbandonada =
        item.Status === 'Abandonada' ||
        item.Estado_llamada?.toLowerCase().includes('abandonada') ||
        item.Estado_llamada?.toLowerCase().includes('desbordada') ||
        item.Estado_llamada?.toLowerCase().includes('asignada en falla');
      if (esAbandonada) stats.Abandonada++;
      else stats.Atendida++;
    });
    return resultado;
  }
}
