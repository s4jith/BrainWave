'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    closeOnBackdrop?: boolean;
    className?: string;
}

const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]',
};

export function Modal({
    open,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
    closeOnBackdrop = true,
    className,
}: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={(e) => {
                if (closeOnBackdrop && e.target === overlayRef.current) onClose();
            }}
        >
            <div
                className={cn(
                    'relative flex w-full flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800',
                    sizeMap[size],
                    'max-h-[90vh]',
                    className
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
                    <div>
                        <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h2>
                        {description && (
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        aria-label="Close modal"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-6">{children}</div>

                {/* Optional footer */}
                {footer && (
                    <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-xl border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'destructive' | 'warning' | 'default';
    loading?: boolean;
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'destructive',
    loading,
}: ConfirmDialogProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button variant={variant} onClick={onConfirm} loading={loading}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
        </Modal>
    );
}

interface TabsModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    tabs: { key: string; label: string; icon?: ReactNode }[];
    activeTab: string;
    onTabChange: (key: string) => void;
    children: ReactNode;
    size?: ModalProps['size'];
}

export function TabsModal({
    open,
    onClose,
    title,
    tabs,
    activeTab,
    onTabChange,
    children,
    size = 'lg',
}: TabsModalProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} size={size}>
            <div className="-mt-2 mb-6 flex gap-1 border-b border-gray-200 dark:border-gray-700">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                            activeTab === tab.key
                                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>
            {children}
        </Modal>
    );
}
