// LoadingSpinner – thin wrapper re-exporting PageLoader as a named default
// Kept for backwards compatibility with legacy imports (book-to-bot)
'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
    message?: string;
    submessage?: string;
}

// Full-page centred loading indicator compatible with old frontend API
export default function LoadingSpinner({ message = 'Loading…', submessage }: Props) {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-base font-medium text-gray-900 dark:text-white">{message}</p>
            {submessage && <p className="text-sm text-gray-400">{submessage}</p>}
        </div>
    );
}
