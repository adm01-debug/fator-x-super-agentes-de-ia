import { Input } from '@/components/ui/input';
import { FieldWrapper } from './FieldWrapper';

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
  return (
    <FieldWrapper label={label} hint={hint} className={className}>
      {({ id, hintId }) => (
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
      )}
    </FieldWrapper>
  );
}
