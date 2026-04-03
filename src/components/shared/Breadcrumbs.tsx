import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Fragment, useMemo } from "react";

const routeLabels: Record<string, string> = {
  "": "Dashboard",
  agents: "Agentes",
  new: "Novo Agente",
  builder: "Agent Builder",
  brain: "Super Cérebro",
  oracle: "Oráculo",
  knowledge: "Knowledge / RAG",
  memory: "Memory",
  tools: "Tools & Integrations",
  prompts: "Prompts",
  workflows: "Workflows",
  evaluations: "Evaluations",
  deployments: "Deployments",
  monitoring: "Monitoring",
  "data-storage": "Data & Storage",
  datahub: "DataHub",
  security: "Security & Guardrails",
  lgpd: "LGPD Compliance",
  approvals: "Aprovações",
  team: "Team & Roles",
  billing: "Billing / Usage",
  settings: "Settings",
  admin: "Admin BD",
  auth: "Autenticação",
  "reset-password": "Redefinir Senha",
};

interface BreadcrumbItem {
  label: string;
  path: string;
  isLast: boolean;
}

export function Breadcrumbs() {
  const location = useLocation();

  const crumbs = useMemo<BreadcrumbItem[]>(() => {
    const segments = location.pathname.split("/").filter(Boolean);

    if (segments.length === 0) return [];

    const items: BreadcrumbItem[] = [];
    let currentPath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;

      // Skip UUID-like segments in breadcrumb label but keep them in path
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(segment);
      const label = isUuid
        ? "Detalhes"
        : routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

      items.push({
        label,
        path: currentPath,
        isLast: i === segments.length - 1,
      });
    }

    return items;
  }, [location.pathname]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-foreground transition-colors rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Ir para o Dashboard"
      >
        <Home className="h-3 w-3" aria-hidden="true" />
      </Link>

      {crumbs.map((crumb) => (
        <Fragment key={crumb.path}>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" aria-hidden="true" />
          {crumb.isLast ? (
            <span className="text-foreground font-medium truncate max-w-[200px]" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors truncate max-w-[150px] rounded-sm px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
