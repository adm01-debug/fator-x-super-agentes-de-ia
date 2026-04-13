import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

interface DataBrowserPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  dataLength: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function DataBrowserPagination({ page, pageSize, total, dataLength, onPageChange, onPageSizeChange }: DataBrowserPaginationProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <p className="text-[11px] text-muted-foreground">
          Mostrando {dataLength > 0 ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, total)} de {total.toLocaleString()}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Por página:</span>
          <Select value={String(pageSize)} onValueChange={v => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-7 w-[65px] text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(size => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => onPageChange(0)}><ChevronsLeft className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <span className="text-[11px] text-muted-foreground px-2 min-w-[60px] text-center">{page + 1} / {totalPages || 1}</span>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)}><ChevronsRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
