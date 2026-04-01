import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TableName = keyof Database['public']['Tables'];

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

interface QueryConfig {
  table: TableName;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
  select?: string;
  enabled?: boolean;
  eqFilters?: Record<string, string>;
}

export function usePaginatedQuery<T = Record<string, unknown>>(
  config: QueryConfig,
): UsePaginatedQueryResult<T> {
  const {
    table,
    pageSize = 20,
    orderBy = 'created_at',
    ascending = false,
    select = '*',
    enabled = true,
    eqFilters = {},
  } = config;

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

        // Count
        let countBuilder = supabase.from(table).select('*', { count: 'exact', head: true });
        for (const [col, val] of Object.entries(eqFilters)) {
          countBuilder = countBuilder.eq(col, val);
        }
        const { count } = await countBuilder;
        const total = count ?? 0;

        // Data
        let dataBuilder = supabase.from(table).select(select).order(orderBy, { ascending }).range(from, to);
        for (const [col, val] of Object.entries(eqFilters)) {
          dataBuilder = dataBuilder.eq(col, val);
        }
        const { data: rows, error: qErr } = await dataBuilder;
        if (qErr) throw qErr;

        setData((rows ?? []) as T[]);
        setPagination({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Query failed');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, pageSize, orderBy, ascending, select, enabled, JSON.stringify(eqFilters)],
  );

  useEffect(() => {
    if (enabled) fetchPage(1);
  }, [fetchPage, enabled]);

  const goToPage = useCallback(
    (p: number) => { if (p >= 1 && p <= Math.max(pagination.totalPages, 1)) fetchPage(p); },
    [fetchPage, pagination.totalPages],
  );
  const nextPage = useCallback(() => goToPage(pagination.page + 1), [goToPage, pagination.page]);
  const prevPage = useCallback(() => goToPage(pagination.page - 1), [goToPage, pagination.page]);
  const refresh = useCallback(() => fetchPage(pagination.page), [fetchPage, pagination.page]);

  return { data, loading, error, pagination, goToPage, nextPage, prevPage, refresh };
}
