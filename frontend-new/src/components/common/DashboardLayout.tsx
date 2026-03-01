// @ts-nocheck
'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

interface DashboardLayoutProps {
    children: ReactNode;
    title?: string;
    icon?: ReactNode;
}

export function DashboardLayout({ children, title = '', icon }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Navbar title={title} icon={icon} />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
