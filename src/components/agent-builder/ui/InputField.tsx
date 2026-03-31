import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  disabled?: boolean;
  hint?: string;
}

export function InputField({ label, value, onChange, placeholder, type = 'text', className, disabled, hint }: InputFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={hintId}
        className="bg-muted/30 border-border text-sm"
      />
      {hint && <p id={hintId} className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
