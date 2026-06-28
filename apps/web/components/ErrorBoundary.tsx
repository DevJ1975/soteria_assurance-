'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SoteriaStrings } from '@soteria/core';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional override for the fallback heading. */
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Class-based error boundary (RULE 8 — every major screen is wrapped so an
 * audit in progress never white-screens). On error it renders a recoverable
 * fallback with a Retry action that resets the boundary.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : SoteriaStrings.errors.generic;
    return { hasError: true, message };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced to the browser console only; this is a legitimate debug path for
    // a caught render error (not a stray log). No remote logging on the client.
    // eslint-disable-next-line no-console
    console.error('[Soteria] Screen error boundary caught:', error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-64 flex-col items-center justify-center gap-md p-xl text-center"
        >
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {this.props.title ?? SoteriaStrings.errors.generic}
          </h2>
          <p className="max-w-md text-sm text-text-secondary">{this.state.message}</p>
          <Button variant="outline" onClick={this.handleRetry}>
            {SoteriaStrings.common.retry}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
