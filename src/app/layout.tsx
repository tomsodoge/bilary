import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Bilary - Belegverwaltung',
  description: 'Belegverwaltung und Buchhaltung mit Bilary',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
