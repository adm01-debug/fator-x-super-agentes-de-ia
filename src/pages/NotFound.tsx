import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.warn("404: Non-existent route accessed", { path: location.pathname });
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="text-center max-w-md space-y-6 animate-page-enter">
        <div className="text-7xl font-heading font-extrabold nexus-gradient-text select-none">404</div>
        <div className="space-y-2">
          <h1 className="text-xl font-heading font-bold text-foreground">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A rota <code className="text-xs bg-secondary/60 px-1.5 py-0.5 rounded font-mono">{location.pathname}</code> não existe ou foi movida.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button asChild className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Link to="/"><Home className="h-4 w-4" /> Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
