interface SectionTitleProps {
  icon?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}

export function SectionTitle({ icon, title, subtitle, badge }: SectionTitleProps) {
  return (
    <div className="flex items-start gap-3 mb-5">
      {icon && <span className="text-xl mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground tracking-tight font-heading">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
