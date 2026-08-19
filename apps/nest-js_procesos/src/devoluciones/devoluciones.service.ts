import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DevolucionesService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async procesarDevoluciones(
    tipo: string,
    registros: Array<{
      identificador: string;
      codStatus: string;
      fecha: string;
    }>,
  ) {
    // Validaciones
    if (!tipo || (tipo !== 'carven' && tipo !== 'numcredito')) {
      throw new BadRequestException('Tipo de identificador inválido');
    }

    if (!registros || registros.length === 0) {
      throw new BadRequestException('No se enviaron registros');
    }

    // Limpiar registros
    const registrosLimpiados = registros
      .map((r) => ({
        identificador: r.identificador?.toString().trim() || '',
        codStatus: r.codStatus?.toString().trim() || '',
        fecha: r.fecha?.toString().trim() || '',
      }))
      .filter(
        (r) => r.identificador !== '' && r.codStatus !== '' && r.fecha !== '',
      );

    if (registrosLimpiados.length === 0) {
      throw new BadRequestException('No se encontraron registros válidos');
    }

    // Validar formato de fecha (dd/mm/aaaa)
    const fechaRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    for (const registro of registrosLimpiados) {
      if (!fechaRegex.test(registro.fecha)) {
        throw new BadRequestException(
          `Fecha inválida: ${registro.fecha}. Debe tener formato dd/mm/aaaa`,
        );
      }
    }

    // Determinar el campo de búsqueda
    const campoBusqueda = tipo === 'carven' ? 'DEACVEDEUDOR' : 'DEANUMCREDITO';

    try {
      // Tipificar explícitamente los arrays
      const resultados: Array<{
        identificador: string;
        codStatus: string;
        fecha: string;
        actualizado: boolean;
      }> = [];

      const actualizados: string[] = [];

      // Procesar cada registro individualmente
      for (const registro of registrosLimpiados) {
        const query = `
          UPDATE TBDEUDOR 
          SET STNCVESTATUS = $1, DEFFECDEVOLUCION = $2 
          WHERE ${campoBusqueda} = $3
          RETURNING ${campoBusqueda}
        `;

        // Convertir fecha de dd/mm/aaaa a formato para PostgreSQL (yyyy-mm-dd)
        const [dia, mes, año] = registro.fecha.split('/');
        const fechaFormateada = `${año}-${mes}-${dia}`;

        const result = await this.pool.query(query, [
          registro.codStatus,
          fechaFormateada,
          registro.identificador,
        ]);

        if (result.rows.length > 0) {
          actualizados.push(registro.identificador);
          resultados.push({
            identificador: registro.identificador,
            codStatus: registro.codStatus,
            fecha: registro.fecha,
            actualizado: true,
          });
        } else {
          resultados.push({
            identificador: registro.identificador,
            codStatus: registro.codStatus,
            fecha: registro.fecha,
            actualizado: false,
          });
        }
      }

      return {
        mensaje: 'Devoluciones procesadas correctamente',
        tipo: tipo,
        totalEnviadas: registrosLimpiados.length,
        actualizados: actualizados.length,
        noEncontrados: registrosLimpiados.length - actualizados.length,
        actualizadosLista: actualizados,
        resultados: resultados,
        fecha: new Date().toISOString(),
      };
    } catch (err) {
      console.error('Error al procesar devoluciones:', err);
      throw new InternalServerErrorException(
        'Error al procesar las devoluciones en la base de datos',
      );
    }
  }
}
