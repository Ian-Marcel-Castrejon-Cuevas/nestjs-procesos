import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class StatusService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async cambiarStatus(status: string, claves: string[]) {
    // Validaciones
    if (!status || status.trim() === '') {
      throw new BadRequestException('El status es requerido');
    }

    if (!claves || claves.length === 0) {
      throw new BadRequestException('No se enviaron claves');
    }

    // Limpiar claves (eliminar espacios en blanco)
    const clavesLimpias = claves.map((c) => c.trim()).filter((c) => c !== '');

    if (clavesLimpias.length === 0) {
      throw new BadRequestException('No se encontraron claves válidas');
    }

    try {
      // Construir la consulta con placeholders para PostgreSQL
      const placeholders = clavesLimpias.map((_, i) => `$${i + 2}`).join(', ');
      const query = `
        UPDATE TBDEUDOR 
        SET STNCVESTATUS = $1 
        WHERE DEACVEDEUDOR IN (${placeholders})
        RETURNING DEACVEDEUDOR
      `;

      // Ejecutar la consulta con todos los parámetros
      const result = await this.pool.query(query, [status, ...clavesLimpias]);

      // Determinar cuáles claves no se actualizaron
      const actualizadas = result.rows.map((row) => row.deacvedeudor);
      const noEncontradas = clavesLimpias.filter(
        (c) => !actualizadas.includes(c),
      );

      return {
        mensaje: 'Status actualizado correctamente',
        status: status,
        totalEnviadas: clavesLimpias.length,
        actualizadas: actualizadas.length,
        noEncontradas: noEncontradas,
        clavesActualizadas: actualizadas,
        clavesNoEncontradas: noEncontradas,
        fecha: new Date().toISOString(),
      };
    } catch (err) {
      console.error('Error al actualizar status:', err);
      throw new InternalServerErrorException(
        'Error al actualizar el status en la base de datos',
      );
    }
  }

  // Método opcional para verificar el status actual de una clave
  async obtenerStatusPorClave(clave: string) {
    try {
      const query = `
        SELECT DEACVEDEUDOR, STNCVESTATUS 
        FROM TBDEUDOR 
        WHERE DEACVEDEUDOR = $1
      `;
      const result = await this.pool.query(query, [clave]);
      return result.rows[0] || null;
    } catch (err) {
      console.error('Error al obtener status:', err);
      throw new InternalServerErrorException('Error al consultar el status');
    }
  }

  // Método para obtener status de múltiples claves
  async obtenerStatusPorClaves(claves: string[]) {
    if (!claves || claves.length === 0) {
      throw new BadRequestException('No se enviaron claves');
    }

    try {
      const placeholders = claves.map((_, i) => `$${i + 1}`).join(', ');
      const query = `
        SELECT DEACVEDEUDOR, STNCVESTATUS 
        FROM TBDEUDOR 
        WHERE DEACVEDEUDOR IN (${placeholders})
      `;
      const result = await this.pool.query(query, claves);
      return result.rows;
    } catch (err) {
      console.error('Error al obtener status:', err);
      throw new InternalServerErrorException('Error al consultar los status');
    }
  }
}
