'use client'

import * as React from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: (err: Error, reset: () => void) => React.ReactNode
  /** Change this value (e.g. pathname) to force the boundary to reset on navigation */
  resetKey?: string | number
  onError?: (err: Error, info: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught:', error, info)
    }
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (
      this.state.error &&
      prev.resetKey !== this.props.resetKey
    ) {
      this.reset()
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }
      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />
    }
    return this.props.children
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center animate-fade-in">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This part of the page failed to render. You can try again or reload
            the tab.
          </p>
        </div>
        <details className="w-full rounded-lg bg-muted/40 p-3 text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer font-mono font-medium">
            Error details
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-destructive/80">
            {error.message}
          </pre>
        </details>
        <div className="flex gap-2">
          <Button onClick={reset} variant="primary" size="sm">
            <RotateCw className="h-3.5 w-3.5" />
            Try again
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            size="sm"
          >
            Reload page
          </Button>
        </div>
      </Card>
    </div>
  )
}
