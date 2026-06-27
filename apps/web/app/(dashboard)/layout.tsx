'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { AICopilotPanel } from '@/components/AICopilotPanel';
import { RouteGuard } from '@/components/RouteGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Authenticated app shell: sidebar nav + topbar (sync/status, sign-out, AI
 * trigger) + slide-in co-pilot. Guarded by RouteGuard and wrapped in an
 * ErrorBoundary so an audit in progress never white-screens (RULE 8).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [copilotOpen, setCopilotOpen] = useState(false);

  return (
    <RouteGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenCopilot={() => setCopilotOpen(true)} />
          <main className="flex-1 overflow-y-auto p-lg">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
        <AICopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      </div>
    </RouteGuard>
  );
}
