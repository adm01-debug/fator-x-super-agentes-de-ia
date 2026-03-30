import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleField({ label, description, checked, onCheckedChange, disabled, className }: ToggleFieldProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1', className)}>
      <div className="min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
