import { IsOptional, IsString, IsDateString } from 'class-validator';

export class EjecutarReporteDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;
}

export class EjecutarCuentaDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}

export class ResumenProcesoDto {
  totalCuentas: number;
  cuentasExitosas: number;
  cuentasFallidas: number;
  detalles: {
    customerId: string;
    nombreCuenta: string;
    exitoso: boolean;
    error?: string;
    registrosInsertados?: number;
  }[];
  fechaInicio: Date;
  fechaFin: Date;
}
