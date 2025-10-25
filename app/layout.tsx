import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Asahikawa Voice Translator',
  description: 'Real-time voice translation PWA for Asahikawa visitors',
  manifest: '/manifest.webmanifest',
  themeColor: '#3b82f6',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AVT',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}


