import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class VerificacionService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async verificarClaves(claves: string[]) {
    if (!claves || claves.length === 0) {
      throw new BadRequestException('No se enviaron claves');
    }

    try {
      const query = `
        SELECT  
          tbdeudor.deacvedeudor AS Clave,
          tbdirecciones.diacodpostal AS CP,
          tbmunicipios.cpanommunicipio AS Municipio,
          tbestados.cpanombre AS Estado
        FROM tbdirecciones
        JOIN tbmunicipios 
          ON tbmunicipios.cpacvemunicipio = tbdirecciones.cpacvemunicipio
         AND tbmunicipios.cpacveestado = tbdirecciones.cpacveestado 
        JOIN tbestados 
          ON tbestados.cpacveestado = tbdirecciones.cpacveestado
        JOIN tbdeudor 
          ON tbdeudor.deacvedeudor = tbdirecciones.deacvedeudor
        WHERE tbestados.cpacveestado = '15'
          AND tbmunicipios.cpacvemunicipio IN ('025','020','122')
          AND tbdeudor.deacvedeudor = ANY($1::text[])
      `;

      const result = await this.pool.query(query, [claves]);
      return result.rows;
    } catch (err) {
      console.error('Error en query:', err);
      throw new InternalServerErrorException('Error en la base de datos');
    }
  }

  async borrarIngresosAntiguos() {
    try {
      const query = `DELETE FROM tbingresos WHERE infingreso >= CURRENT_DATE`;
      const result = await this.pool.query(query);
      
      return {
        mensaje: 'Registros botados exitosamente',
        registrosEliminados: result.rowCount,
        fechaActual: new Date().toISOString()
      };
    } catch (err) {
      console.error('Error al borrar ingresos:', err);
      throw new InternalServerErrorException('Error al borrar los registros de ingresos');
    }
  }
}