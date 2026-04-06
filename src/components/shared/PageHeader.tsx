import { Breadcrumbs } from "./Breadcrumbs";
import { BackButton } from "./BackButton";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Show back button — pass string for specific route, true for history back */
  backTo?: string | boolean;
  /** Hide breadcrumbs */
  hideBreadcrumbs?: boolean;
  /** Use gradient text for the title */
  gradient?: boolean;
}

export function PageHeader({ title, description, actions, backTo, hideBreadcrumbs, gradient = true }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {!hideBreadcrumbs && <Breadcrumbs />}
      {backTo && (
        <BackButton to={typeof backTo === "string" ? backTo : undefined} />
      )}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-heading font-bold tracking-tight ${gradient ? 'nexus-gradient-text' : 'text-foreground'}`}>{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 mt-3 sm:mt-0">{actions}</div>}
      </div>
    </div>
  );
}
