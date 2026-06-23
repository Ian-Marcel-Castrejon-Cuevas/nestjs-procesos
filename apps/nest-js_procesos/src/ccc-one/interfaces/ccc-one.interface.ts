export interface CorreoResultado {
  status: 'OK' | 'SIN_REGISTROS' | 'SIN_LINK' | 'TIMEOUT';
  link?: string;
  correoId?: string;
}

export interface TrabajoDescarga {
  tipo: string;
  fechaDesde: string;
  fechaHasta: string;
  solicitadoPor: string;
  filaIndex: number;
  canal: string;
  campaña: string;
}

export interface ResultadoDescarga {
  canal: string;
  success: boolean;
  archivos?: string | string[];
  error?: string;
}

export interface ResultadoEjecucion {
  canal: string;
  exito: boolean;
  mensaje: string;
  archivoGenerado?: string | string[];
}
