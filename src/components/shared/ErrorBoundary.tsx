import { logger } from '@/lib/logger';
import { captureException } from '@/lib/sentry';
import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  retryCount: number;
}

const MAX_RETRIES = 3;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorInfo = info.componentStack || '';
    this.setState({ errorInfo });

    // Structured error logging
    logger.error("[ErrorBoundary] Uncaught error:", {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      componentStack: errorInfo.split('\n').slice(0, 5).join('\n'),
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
    });

    // Direct Sentry capture preserves the original Error + componentStack
    captureException(error, {
      componentStack: errorInfo,
      retryCount: this.state.retryCount,
      boundary: 'ErrorBoundary',
    });
  }

  handleReset = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const canRetry = this.state.retryCount < MAX_RETRIES;

      return (
        <div className="flex-1 flex items-center justify-center min-h-[60vh] p-6" role="alert" aria-live="assertive">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center" aria-hidden="true">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              {canRetry
                ? 'Ocorreu um erro inesperado. Tente novamente ou volte para o início.'
                : 'O erro persiste após várias tentativas. Recarregue a página ou entre em contato com o suporte.'}
            </p>
            {this.state.error && (
              <details className="w-full">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Detalhes técnicos
                </summary>
                <pre className="w-full rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground overflow-auto max-h-32 text-left font-mono mt-2">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              {canRetry ? (
                <Button variant="outline" size="sm" onClick={this.handleReset} aria-label="Tentar renderizar novamente">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Tentar novamente ({MAX_RETRIES - this.state.retryCount} restantes)
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} aria-label="Recarregar página">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Recarregar página
                </Button>
              )}
              <Button size="sm" onClick={() => { window.location.href = "/"; }} aria-label="Navegar ao início">
                Ir ao início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
