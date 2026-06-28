import type { Metadata, Viewport } from 'next';
import { Montserrat, Inter, JetBrains_Mono } from 'next/font/google';
import { SoteriaStrings } from '@soteria/core';
import { Providers } from './providers';
import './globals.css';

/**
 * Brand fonts wired through next/font and bound to CSS variables that match the
 * token font-family names (display/body/mono — RULE 5).
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: SoteriaStrings.common.appName,
  description: 'ISO 45001:2018 AI-powered audit management platform.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
