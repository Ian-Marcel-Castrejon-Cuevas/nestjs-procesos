import axios from 'axios';
import { LlamadaTransformadaDto } from '../dto/reporte-inbound.dto';

/**
 * Helper que construye la configuración de gráficas y obtiene imágenes via QuickChart.
 */
export class ChartApiHelper {
  static async generarGraficaComoImagen(
    data: LlamadaTransformadaDto[],
    fechaStr: string,
  ): Promise<Buffer> {
    const areasPermitidas = ['BBVA', 'GMF', 'TOYOTA', 'AT&T'];

    const filteredData = data.filter((item) => {
      const areaValida = areasPermitidas.some((area) =>
        item.Area?.toUpperCase().includes(area.toUpperCase()),
      );
      const herramientaValida =
        !item.Med_Contacto?.toUpperCase().includes('OTRO');
      return areaValida && herramientaValida;
    });

    console.log(`Gráfica - Datos filtrados: ${filteredData.length}`);

    const resumen = this.procesarDatosGrafica(filteredData);

    const labels: string[] = [];
    const atendidasData: number[] = [];
    const abandonadasData: number[] = [];

    const areasOrdenadas = ['AT&T', 'BBVA', 'BBVA_REF', 'GMF', 'TOYOTA'];

    for (const area of areasOrdenadas) {
      if (!resumen.has(area)) continue;

      const herramientas = resumen.get(area)!;
      const herramientasOrdenadas = Array.from(herramientas.keys()).sort();

      for (const herramienta of herramientasOrdenadas) {
        const stats = herramientas.get(herramienta)!;
        labels.push(`${area} ${herramienta}`);
        atendidasData.push(stats.Atendida);
        abandonadasData.push(stats.Abandonada);
      }
    }

    const dynamicHeight = Math.max(
      550,
      Math.min(850, 450 + Math.floor(labels.length / 2) * 30),
    );

    const chartConfig = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Atendidas',
            data: atendidasData,
            backgroundColor: '#9B59B6',
            borderColor: '#8E44AD',
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          },
          {
            label: 'Abandonadas',
            data: abandonadasData,
            backgroundColor: '#3498DB',
            borderColor: '#2980B9',
            borderWidth: 2,
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: `LLAMADAS POR ÁREA Y HERRAMIENTA - ${fechaStr}`,
            font: { size: 16, weight: 'bold' },
            color: '#2C3E50',
          },
          legend: {
            position: 'top',
            labels: {
              font: { size: 13, weight: 'bold' },
              usePointStyle: true,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            offset: 4,
            color: '#333',
            fontWeight: 'bold',
            fontSize: 12,
            formatter: (value: number) => value.toString(),
          },
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Cantidad de Llamadas',
              font: { weight: 'bold', size: 12 },
            },
            beginAtZero: true,
            grid: { color: '#E0E0E0' },
            ticks: {
              stepSize: 50,
              callback: (value: number) => value.toLocaleString('es-MX'),
              font: { size: 11 },
            },
          },
          x: {
            title: {
              display: true,
              text: 'Área - Herramienta',
              font: { weight: 'bold', size: 12 },
            },
            grid: { display: false },
            ticks: {
              autoSkip: false,
              maxRotation: 35,
              minRotation: 35,
              font: { size: 10, weight: 'normal' },
            },
          },
        },
        layout: {
          padding: {
            left: 30,
            right: 30,
            top: 30,
            bottom: 50,
          },
        },
      },
    };

    const url = `https://quickchart.io/chart?c=${encodeURIComponent(
      JSON.stringify(chartConfig),
    )}&w=1200&h=${dynamicHeight}&bkg=white&devicePixelRatio=2&f=png&v=2`;

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    return Buffer.from(response.data);
  }

  private static procesarDatosGrafica(
    data: LlamadaTransformadaDto[],
  ): Map<string, Map<string, { Atendida: number; Abandonada: number }>> {
    const resultado = new Map();

    data.forEach((item) => {
      let area = item.Area || 'Sin área';
      const herramienta = item.Med_Contacto || 'Sin herramienta';

      if (area.toUpperCase().includes('BBVA')) {
        if (area.toUpperCase().includes('_REF') || area === 'BBVA_REF') {
          area = 'BBVA_REF';
        } else {
          area = 'BBVA';
        }
      } else if (area.toUpperCase().includes('GMF')) {
        area = 'GMF';
      } else if (area.toUpperCase().includes('TOYOTA')) {
        area = 'TOYOTA';
      } else if (
        area.toUpperCase().includes('ATT') ||
        area.toUpperCase().includes('AT&T')
      ) {
        area = 'AT&T';
      } else {
        return;
      }

      if (!resultado.has(area)) {
        resultado.set(area, new Map());
      }

      const herramientas = resultado.get(area)!;
      if (!herramientas.has(herramienta)) {
        herramientas.set(herramienta, { Atendida: 0, Abandonada: 0 });
      }

      const stats = herramientas.get(herramienta)!;
      const esAbandonada =
        item.Status === 'Abandonada' ||
        item.Estado_llamada?.toLowerCase().includes('abandonada') ||
        item.Estado_llamada?.toLowerCase().includes('desbordada') ||
        item.Estado_llamada?.toLowerCase().includes('asignada en falla');

      if (esAbandonada) {
        stats.Abandonada++;
      } else {
        stats.Atendida++;
      }
    });

    return resultado;
  }
}
