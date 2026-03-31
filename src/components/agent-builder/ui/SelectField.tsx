import { useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  hint?: string;
}

export function SelectField({ label, value, onChange, options, placeholder, className, disabled, hint }: SelectFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="bg-muted/30 border-border text-sm" aria-describedby={hintId}>
          <SelectValue placeholder={placeholder ?? 'Selecione...'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p id={hintId} className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
