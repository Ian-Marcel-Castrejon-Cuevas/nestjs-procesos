export class ProcesarDevolucionDto {
  tipo: string; // "carven" o "numcredito"
  registros: Array<{
    identificador: string;
    codStatus: string;
    fecha: string;
  }>;
}
