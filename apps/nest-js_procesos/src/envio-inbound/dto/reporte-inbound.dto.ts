export class ResumenCampanaDto {
  Campaña: string;
  Area: string;
  Abandonada: number;
  Atendida: number;
  Total_general: number;
  Porcentaje_de_Abandono: number;
}

export class ResumenContactoDto {
  Area: string;
  Med_Contacto: string;
  Abandonada: number;
  Atendida: number;
  Total_general: number;
  Porcentaje_de_Abandono: number;
}

export class LlamadaTransformadaDto {
  Fecha: Date;
  Hora: string;
  Campaña: string;
  Estado_llamada: string;
  Status: string;
  Area: string;
  Med_Contacto: string;
  DID: string;
  Origen: string;
  Tiempo_llamada: number;
  Id_llamada: string;
  Id_grabación: string;
}