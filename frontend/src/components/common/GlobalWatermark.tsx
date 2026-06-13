"use client";

import { useQuery } from "@tanstack/react-query";
import { SettingsService } from "@services/SettingsService";
import type { WatermarkSettings } from "@repositories/SettingsRepository";

function normalize(raw: WatermarkSettings | undefined | null) {
  return {
    enabled: Boolean(raw?.enabled),
    primaryText: String(raw?.primaryText ?? "").trim(),
    secondaryText: String(raw?.secondaryText ?? "").trim(),
    primaryLogoUrl: String(raw?.primaryLogoUrl ?? "").trim(),
    secondaryLogoUrl: String(raw?.secondaryLogoUrl ?? "").trim(),
  };
}

/**
 * Renders the platform-wide watermark strip when the admin has enabled
 * it. Safe to mount globally — it returns null when there's nothing to
 * show, and the query failure path falls back to "hidden".
 */
export function GlobalWatermark() {
  const { data } = useQuery({
    queryKey: ["settings", "watermark"],
    queryFn: () => SettingsService.getWatermark(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const wm = normalize(data);
  const hasContent =
    wm.enabled &&
    (wm.primaryText || wm.secondaryText || wm.primaryLogoUrl || wm.secondaryLogoUrl);
  if (!hasContent) return null;

  return (
    <div className="w-full border-t border-slate-200 bg-white/90 backdrop-blur px-6 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex min-w-0 items-center gap-2">
          {wm.primaryLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wm.primaryLogoUrl}
              alt="Primary watermark"
              className="h-6 w-6 rounded border border-slate-200 object-cover"
            />
          ) : null}
          <span className="truncate">{wm.primaryText}</span>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate">{wm.secondaryText}</span>
          {wm.secondaryLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wm.secondaryLogoUrl}
              alt="Secondary watermark"
              className="h-6 w-6 rounded border border-slate-200 object-cover"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
