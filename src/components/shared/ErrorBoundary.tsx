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
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex-1 flex items-center justify-center min-h-[60vh] p-6" role="alert">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página ou volte para o início.
            </p>
            {this.state.error && (
              <pre className="w-full rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground overflow-auto max-h-32 text-left font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Tentar novamente
              </Button>
              <Button size="sm" onClick={() => { window.location.href = "/"; }}>
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
