import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UsePaginatedQueryOptions<T> {
  table: string;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
  filters?: Array<{ column: string; operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'ilike' | 'in'; value: unknown }>;
  select?: string;
  enabled?: boolean;
  transform?: (row: Record<string, unknown>) => T;
}

export interface UsePaginatedQueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

export function usePaginatedQuery<T = Record<string, unknown>>(
  options: UsePaginatedQueryOptions<T>,
): UsePaginatedQueryResult<T> {
  const {
    table,
    pageSize = 20,
    orderBy = 'created_at',
    ascending = false,
    filters = [],
    select = '*',
    enabled = true,
    transform,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 0,
  });

  const fetchPage = useCallback(
    async (page: number) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);

      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // Build count query
        let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
        for (const f of filters) {
          countQuery = (countQuery as ReturnType<typeof countQuery>).filter(f.column, f.operator, f.value);
        }
        const { count } = await countQuery;
        const total = count ?? 0;

        // Build data query
        let dataQuery = supabase
          .from(table)
          .select(select)
          .order(orderBy, { ascending })
          .range(from, to);

        for (const f of filters) {
          dataQuery = (dataQuery as ReturnType<typeof dataQuery>).filter(f.column, f.operator, f.value);
        }

        const { data: rows, error: queryError } = await dataQuery;
        if (queryError) throw queryError;

        const transformed = transform
          ? (rows || []).map((r) => transform(r as Record<string, unknown>))
          : ((rows || []) as T[]);

        setData(transformed);
        setPagination({
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Query failed');
      } finally {
        setLoading(false);
      }
    },
    [table, pageSize, orderBy, ascending, JSON.stringify(filters), select, enabled, transform],
  );

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= Math.max(pagination.totalPages, 1)) {
        fetchPage(page);
      }
    },
    [fetchPage, pagination.totalPages],
  );

  const nextPage = useCallback(() => goToPage(pagination.page + 1), [goToPage, pagination.page]);
  const prevPage = useCallback(() => goToPage(pagination.page - 1), [goToPage, pagination.page]);
  const refresh = useCallback(() => fetchPage(pagination.page), [fetchPage, pagination.page]);

  // Initial fetch
  useState(() => {
    if (enabled) fetchPage(1);
  });

  return { data, loading, error, pagination, goToPage, nextPage, prevPage, refresh };
}
