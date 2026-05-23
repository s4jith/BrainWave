import { X } from 'lucide-react';

export default function PdfPreviewModal({ open, fileUrl, title, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-2xl">
        <div className="h-12 px-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 truncate">{title || 'PDF Preview'}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100"
            title="Close preview"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="h-[calc(100%-3rem)] bg-gray-100">
          <iframe
            src={`${fileUrl || ''}#toolbar=1&navpanes=0&view=FitH`}
            title={title || 'PDF Preview'}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
