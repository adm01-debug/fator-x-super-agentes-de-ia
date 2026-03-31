import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/agents": "Agentes",
  "/agents/new": "Criar Agente",
  "/builder": "Agent Builder",
  "/brain": "Super Cérebro",
  "/oracle": "Oráculo",
  "/knowledge": "Knowledge / RAG",
  "/memory": "Memory",
  "/tools": "Tools & Integrations",
  "/prompts": "Prompts",
  "/workflows": "Workflows",
  "/evaluations": "Evaluations",
  "/deployments": "Deployments",
  "/monitoring": "Monitoring",
  "/data-storage": "Data & Storage",
  "/security": "Security & Guardrails",
  "/team": "Team & Roles",
  "/billing": "Billing / Usage",
  "/settings": "Settings",
  "/auth": "Login",
};

const APP_NAME = "Fator X";

export function useDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    const exact = routeTitles[pathname];
    if (exact) {
      document.title = `${exact} — ${APP_NAME}`;
      return;
    }

    // Match parent route
    for (const [route, title] of Object.entries(routeTitles)) {
      if (pathname.startsWith(route + "/")) {
        document.title = `${title} — ${APP_NAME}`;
        return;
      }
    }

    document.title = APP_NAME;
  }, [pathname]);
}
