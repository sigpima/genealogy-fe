import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Gia Phả',
  description: 'Ứng dụng quản lý và xem cây gia phả',
};

// Keep this literal string in sync with THEME_STORAGE_KEY in src/lib/theme/storage.ts —
// it can't import that constant since it must run as a plain inline script, before hydration.
const THEME_INIT_SCRIPT = `
try {
  var t = window.localStorage.getItem('genealogy-web:theme');
  if (t === 'warm' || t === 'modern' || t === 'elegant') {
    document.documentElement.setAttribute('data-theme', t);
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} bg-app text-default antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
