import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Telumi Player',
  description: 'Digital Signage Player — Telumi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  );
}
