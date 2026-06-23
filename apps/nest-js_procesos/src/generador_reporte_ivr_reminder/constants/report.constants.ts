export const REPORT_TYPES = {
  BBVA: 'BBVA',
  BBVA_VIG: 'BBVA_VIG',
  ATT: 'ATT',
  GMF: 'GMF',
} as const;

export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

export const REPORT_CONFIGS: Record<
  ReportType,
  {
    searchText: string;
    filenamePrefix: string;
    emailSubject: string;
    networkBase: string;
  }
> = {
  [REPORT_TYPES.BBVA]: {
    searchText: 'BBVA',
    filenamePrefix: 'Reporte_IVR_BBVA',
    emailSubject: 'Envío Reporte IVR BBVA',
    networkBase: process.env.NETWORK_BASE_BBVA || '',
  },
  [REPORT_TYPES.BBVA_VIG]: {
    searchText: 'BBVA_VIG',
    filenamePrefix: 'Reporte_IVR_BBVA_VIG',
    emailSubject: 'Envío Reporte IVR BBVA_VIG',
    networkBase: process.env.NETWORK_BASE_BBVA || '',
  },
  [REPORT_TYPES.ATT]: {
    searchText: 'Campaña AT&T',
    filenamePrefix: 'Reporte_IVR_ATT',
    emailSubject: 'Envío Reporte IVR AT&T',
    networkBase: process.env.NETWORK_BASE_ATT || '',
  },
  [REPORT_TYPES.GMF]: {
    searchText: 'GMF',
    filenamePrefix: 'Reporte_IVR_GMF',
    emailSubject: 'Envío Reporte IVR GMF',
    networkBase: process.env.NETWORK_BASE_GMF || '',
  },
};

export const TIME_CONFIG = {
  START_HOUR: '00',
  START_MINUTE: '00',
  START_SECOND: '00',
  END_HOUR: '23',
  END_MINUTE: '59',
  END_SECOND: '59',
  AMPM_START: 'AM',
  AMPM_END: 'PM',
  DATE_OFFSET_DAYS: -1,
};

export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 5000,
  BACKOFF_MULTIPLIER: 2,
};

export const TIMEOUT_CONFIG = {
  DOWNLOAD_WAIT_MS: 180000,
  DOWNLOAD_TIMEOUT_MS: 240000,
  PAGE_LOAD_WAIT_MS: 3000,
  NAVIGATION_WAIT_MS: 5000,
  LOGIN_TIMEOUT_MS: 30000,
  SEARCH_TIMEOUT_MS: 15000,
};
