import { useEffect, useMemo, useState } from 'react';
import { settingsService } from '../../services/api';

const DEFAULT_WATERMARK = {
  enabled: false,
  primaryText: '',
  secondaryText: '',
  primaryLogoUrl: '',
  secondaryLogoUrl: '',
};

const normalizeWatermark = (raw = {}) => ({
  enabled: Boolean(raw.enabled),
  primaryText: String(raw.primaryText || '').trim(),
  secondaryText: String(raw.secondaryText || '').trim(),
  primaryLogoUrl: String(raw.primaryLogoUrl || '').trim(),
  secondaryLogoUrl: String(raw.secondaryLogoUrl || '').trim(),
});

export default function GlobalWatermark() {
  const [watermark, setWatermark] = useState(DEFAULT_WATERMARK);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await settingsService.getWatermark();
        if (mounted) setWatermark(normalizeWatermark(data));
      } catch {
        if (mounted) setWatermark(DEFAULT_WATERMARK);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const hasContent = useMemo(() => {
    return Boolean(
      watermark.enabled &&
      (watermark.primaryText || watermark.secondaryText || watermark.primaryLogoUrl || watermark.secondaryLogoUrl)
    );
  }, [watermark]);

  if (!hasContent) return null;

  return (
    <div className="w-full border-t border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-6 py-2">
      <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2 min-w-0">
          {watermark.primaryLogoUrl && (
            <img
              src={watermark.primaryLogoUrl}
              alt="Primary watermark"
              className="h-6 w-6 rounded object-cover border border-gray-200 dark:border-gray-700"
            />
          )}
          <span className="truncate">{watermark.primaryText || ''}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="truncate">{watermark.secondaryText || ''}</span>
          {watermark.secondaryLogoUrl && (
            <img
              src={watermark.secondaryLogoUrl}
              alt="Secondary watermark"
              className="h-6 w-6 rounded object-cover border border-gray-200 dark:border-gray-700"
            />
          )}
        </div>
      </div>
    </div>
  );
}
