export interface ReportResult {
  type: string;
  success: boolean;
  filePath?: string;
  error?: string;
  timestamp: Date;
  duration?: number;
}

export interface ReportGenerationOptions {
  forceRegenerate?: boolean;
  skipEmail?: boolean;
  customDate?: Date;
}

export interface DownloadInfo {
  filename: string;
  buffer: Buffer;
  size: number;
}

export interface CampaignInfo {
  name: string;
  hasData: boolean;
  recordsCount?: number;
}
