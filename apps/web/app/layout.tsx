import type { Metadata, Viewport } from 'next';
import { SoteriaStrings } from '@soteria/core';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Providers } from './providers';
// Self-hosted brand fonts (RULE 5 — display/body/mono). Bundled via @fontsource
// so there is NO Google Fonts fetch at build or runtime, keeping the static
// export offline-first and its build hermetic. Weight axis only (no italics);
// the registered families ('Montserrat Variable' etc.) are bound to the token
// font-family CSS variables in globals.css.
import '@fontsource-variable/montserrat/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './globals.css';

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
    <html lang="en">
      <body>
        {/* Root safety net: any client-side throw below the providers (e.g. a
            failed Firebase init) renders a recoverable fallback instead of a
            blank white page. */}
        <ErrorBoundary fullScreen>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
