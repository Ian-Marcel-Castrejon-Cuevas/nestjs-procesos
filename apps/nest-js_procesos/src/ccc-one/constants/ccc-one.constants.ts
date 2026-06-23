import { config } from 'dotenv';
config();

const requiredEnvVars = [
  'CCCONE_USER',
  'CCCONE_PASS',
  'CCCONE_IMAP_USER',
  'CCCONE_IMAP_PASS',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(
      ` ADVERTENCIA: La variable de entorno ${envVar} no está definida. El servicio podría fallar.`,
    );
  }
}

export const CCC_ONE_CONFIG = {
  URL: process.env.CCCONE_URL || 'https://mx.ccc.uno/Login',
  CHROME_PATH:
    process.env.CCCONE_CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  SMTP_SERVER: process.env.SMTP_HOST || '192.168.8.201',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '25'),
  IMAP_SERVER: process.env.CCCONE_IMAP_HOST || '192.168.8.201',
  IMAP_PORT: parseInt(process.env.CCCONE_IMAP_PORT || '143'), // Cambiado a 143 para GroupWise
} as const;

export const CCCONE_CREDENTIALS = {
  USER: process.env.CCCONE_USER || '',
  PASSWORD: process.env.CCCONE_PASS || '',
};

export const CCCONE_IMAP_CREDENTIALS = {
  USER: process.env.CCCONE_IMAP_USER || '',
  PASSWORD: process.env.CCCONE_IMAP_PASS || '',
};

export const CANALES = [
  '0001',
  '0002',
  '0003',
  '0004',
  '0005',
  '0008',
  '0009',
  '0010',
  '0011',
  '0014',
] as const;

export type Canal = (typeof CANALES)[number];

export const CAMPAÑAS_MAP: Record<Canal, string> = {
  '0001': 'BBVA',
  '0008': 'BBVA',
  '0005': 'TYT',
  '0014': 'TYT',
  '0002': 'ATT',
  '0009': 'ATT',
  '0003': 'GMF',
  '0010': 'GMF',
  '0004': 'SCOT',
  '0011': 'SCOT',
};

export const RUTAS_RED_MAP: Record<Canal, string> = {
  '0001': process.env.CCCONE_NETWORK_BASE_0001 || '',
  '0008': process.env.CCCONE_NETWORK_BASE_0008 || '',
  '0002': process.env.CCCONE_NETWORK_BASE_0002 || '',
  '0009': process.env.CCCONE_NETWORK_BASE_0009 || '',
  '0003': process.env.CCCONE_NETWORK_BASE_0003 || '',
  '0010': process.env.CCCONE_NETWORK_BASE_0010 || '',
  '0004': process.env.CCCONE_NETWORK_BASE_0004 || '',
  '0011': process.env.CCCONE_NETWORK_BASE_0011 || '',
  '0005': process.env.CCCONE_NETWORK_BASE_0005 || '',
  '0014': process.env.CCCONE_NETWORK_BASE_0014 || '',
};

export const CONFIG_CANALES_EMAIL: Record<
  Canal,
  { canal: string; destinatarios: string[] }
> = {
  '0001': {
    canal: 'BBVA',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0001?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0008': {
    canal: 'BBVA',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0008?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0005': {
    canal: 'TYT',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0005?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0014': {
    canal: 'TYT',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0014?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0002': {
    canal: 'ATT',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0002?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0009': {
    canal: 'ATT',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0009?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0003': {
    canal: 'GMF',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0003?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0010': {
    canal: 'GMF',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0010?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0004': {
    canal: 'SCOT',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0004?.split(',').filter((d) => d.trim()) ||
      [],
  },
  '0011': {
    canal: 'SCOT',
    destinatarios:
      process.env.CCCONE_EMAIL_DEST_0011?.split(',').filter((d) => d.trim()) ||
      [],
  },
};

export const TIMEOUT_CONFIG_CCC = {
  DOWNLOAD_TIMEOUT_MS: parseInt(
    process.env.CCCONE_DOWNLOAD_TIMEOUT_MS || '120000',
  ),
  PAGE_LOAD_WAIT_MS: parseInt(process.env.CCCONE_PAGE_LOAD_WAIT_MS || '10000'),
  NAVIGATION_WAIT_MS: parseInt(process.env.CCCONE_NAVIGATION_WAIT_MS || '5000'),
  LOGIN_TIMEOUT_MS: parseInt(process.env.CCCONE_LOGIN_TIMEOUT_MS || '30000'),
  SEARCH_TIMEOUT_MS: parseInt(process.env.CCCONE_SEARCH_TIMEOUT_MS || '15000'),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
  RETRY_DELAY_MS: 5000,
};

export const ASUNTO_CORREO_OBJETIVO =
  'Historial de Llamadas - Disposiciones/Notas -- Listo para descargar';
export const TIMEOUT_CORREO_SEGUNDOS = parseInt(
  process.env.CCCONE_EMAIL_TIMEOUT_SEGUNDOS || '21600',
);
export const INTERVALO_CORREO_SEGUNDOS = parseInt(
  process.env.CCCONE_EMAIL_INTERVALO_SEGUNDOS || '5',
);

export const LIMITE_FILAS_CSV = parseInt(
  process.env.CCCONE_LIMITE_FILAS_CSV || '1000000',
);
export const CCCONE_EMAIL_FROM =
  process.env.CCCONE_EMAIL_FROM ||
  process.env.SMTP_FROM ||
  'sistemas3@asecon2006.com.mx';