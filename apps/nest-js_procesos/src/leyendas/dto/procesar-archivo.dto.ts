/**
 * DTO para solicitudes de procesamiento de archivos de leyendas.
 */
export class ProcesarArchivoDto {
  banco: string;
  tipo: string;
  fecha: string;
  tipoGMF?: string;
  columnas: string[];
}
