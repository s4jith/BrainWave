import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../providers/AuthProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import { siteConfig } from '../config/site';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
    description: siteConfig.description,
    metadataBase: new URL(siteConfig.url),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.variable}>
                <AuthProvider>
                    <ThemeProvider>
                        {children}
                    </ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
