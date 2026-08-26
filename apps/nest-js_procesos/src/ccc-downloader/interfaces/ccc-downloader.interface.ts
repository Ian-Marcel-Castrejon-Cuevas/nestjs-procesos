export interface CuentaConfig {
  id: string;
  nombre: string;
}

export interface CredencialesCCC {
  username: string;
  password: string;
}

export interface ResultadoProcesamiento {
  customerId: string;
  nombreCuenta: string;
  exitoso: boolean;
  error?: string;
  registrosInsertados?: number;
  archivoGenerado?: string;
}

export interface RegistroLlamada {
  Cta: string;
  CallID: string;
  Type: string;
  Campaign: string;
  Agent: string;
  CallerID: string;
  CalledNumber: string;
  Destination: string;
  AnswerState: string;
  AMDStatus: string;
  HangupReason: string;
  HangupCode: number | null;
  HangupCodeSIP: number | null;
  DurationSeconds: number | null;
  DurationMinutes: number | null;
  BillTimeMinutes: number | null;
  BillRate: number | null;
  BillCost: number | null;
  StartDateTime: Date | null;
  AnswerDateTime: string | null;
  HangupDateTime: string | null;
  LeadID: string | null;
  ListID: string | null;
  Hora: string | null;
}
