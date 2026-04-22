import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUnsavedChanges } from '@/hooks/unsavedChanges.context';

interface BackButtonProps {
  /** Override target — defaults to browser history back */
  to?: string;
  /** Custom label */
  label?: string;
  className?: string;
}

export function BackButton({ to, label = 'Voltar', className }: BackButtonProps) {
  const navigate = useNavigate();
  const { confirmNavigation } = useUnsavedChanges();

  const handleBack = () => {
    confirmNavigation(() => {
      if (to) {
        navigate(to);
      } else if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/');
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={`gap-2 text-muted-foreground hover:text-foreground -ml-2 group ${className ?? ''}`}
      aria-label={label}
    >
      <ArrowLeft
        className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
      <span className="text-sm">{label}</span>
    </Button>
  );
}
