import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaginationState } from '@/hooks/use-paginated-query';

interface PaginationControlsProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({ pagination, onPageChange, className = '' }: PaginationControlsProps) {
  const { page, totalPages, total, pageSize } = pagination;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (total === 0) return null;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <p className="text-xs text-muted-foreground">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="Primeira página">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-2 font-mono">
          {page}/{totalPages}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Próxima página">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Última página">
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
