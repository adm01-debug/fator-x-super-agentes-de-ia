import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldWrapper } from './FieldWrapper';

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
  return (
    <FieldWrapper label={label} hint={hint} className={className}>
      {({ id, hintId }) => (
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
      )}
    </FieldWrapper>
  );
}
