"use client";

import { X } from "lucide-react";

interface PdfPreviewModalProps {
  open: boolean;
  fileUrl: string | null | undefined;
  title?: string;
  onClose: () => void;
}

export function PdfPreviewModal({ open, fileUrl, title, onClose }: PdfPreviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
          <h3 className="truncate text-sm font-semibold text-slate-800">
            {title ?? "PDF Preview"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-slate-100"
            aria-label="Close preview"
          >
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
        <div className="h-[calc(100%-3rem)] bg-slate-100">
          <iframe
            src={`${fileUrl ?? ""}#toolbar=1&navpanes=0&view=FitH`}
            title={title ?? "PDF Preview"}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
