import { SettingsRepository } from "@repositories/SettingsRepository";

export const SettingsService = {
  getWatermark: SettingsRepository.getWatermark.bind(SettingsRepository),
};
