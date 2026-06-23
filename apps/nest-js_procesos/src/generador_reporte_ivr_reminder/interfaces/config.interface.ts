export interface ReminderConfig {
  url: string;
  username: string;
  password: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  from: string;
  to: string[];
}

export interface StorageConfig {
  bbvaBasePath: string;
  attBasePath: string;
  gmfBasePath: string;
}
