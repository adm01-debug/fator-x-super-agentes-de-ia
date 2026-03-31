import { useId } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  hint?: string;
  className?: string;
  maxLength?: number;
}

export function TextAreaField({ label, value, onChange, placeholder, rows = 4, mono, hint, className, maxLength }: TextAreaFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
        {maxLength && (
          <span className="text-[10px] font-mono text-muted-foreground" aria-live="polite">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        aria-describedby={hintId}
        className={cn(
          'bg-muted/30 border-border text-sm resize-none',
          mono && 'font-mono text-xs'
        )}
      />
      {hint && (
        <p id={hintId} className="text-[11px] text-muted-foreground flex items-start gap-1">
          <span aria-hidden="true">💡</span> {hint}
        </p>
      )}
    </div>
  );
}
