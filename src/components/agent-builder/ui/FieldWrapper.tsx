import { useId } from 'react';
import { cn } from '@/lib/utils';

interface FieldWrapperProps {
  label: string;
  hint?: string;
  className?: string;
  /** Extra element rendered beside the label (e.g. character counter). */
  labelRight?: React.ReactNode;
  /** Override default hint rendering (e.g. add an icon prefix). */
  renderHint?: (hintId: string) => React.ReactNode;
  children: (ids: { id: string; hintId: string | undefined }) => React.ReactNode;
}

export function FieldWrapper({ label, hint, className, labelRight, renderHint, children }: FieldWrapperProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      {labelRight ? (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
          {labelRight}
        </div>
      ) : (
        <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      )}
      {children({ id, hintId })}
      {hint && hintId && (
        renderHint ? renderHint(hintId) : (
          <p id={hintId} className="text-[11px] text-muted-foreground">{hint}</p>
        )
      )}
    </div>
  );
}
