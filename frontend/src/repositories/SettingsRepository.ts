import { BaseRepository } from "./BaseRepository";

export interface WatermarkSettings {
  enabled?: boolean;
  primaryText?: string;
  secondaryText?: string;
  primaryLogoUrl?: string;
  secondaryLogoUrl?: string;
}

class SettingsRepositoryImpl extends BaseRepository {
  constructor() {
    super();
  }

  getWatermark(): Promise<WatermarkSettings> {
    return this.get<WatermarkSettings>(`/api/settings/watermark`);
  }
}

export const SettingsRepository = new SettingsRepositoryImpl();
