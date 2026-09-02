import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'cyrillic'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'TaskPilot — your tasks, under control',
  description: 'A bilingual Telegram task manager with smart reminders and a focused web dashboard.',
  openGraph: {
    title: 'TaskPilot — your tasks, under control',
    description: 'A bilingual Telegram task manager with smart reminders and a focused web dashboard.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'TaskPilot — Your tasks, under control.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskPilot — your tasks, under control',
    description: 'A bilingual Telegram task manager with smart reminders and a focused web dashboard.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" suppressHydrationWarning><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
