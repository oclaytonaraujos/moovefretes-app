import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapSupabaseFreight, fetchPublisherProfiles } from '../utils/helpers';
import type { Driver } from '../types';

const PAGE_SIZE = 20;

async function fetchFreightsPage(driver: Driver | null, cursor: string | null) {
  let query = supabase
    .from('freights')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (driver?.vehicle_types && driver.vehicle_types.length > 0) {
    query = query.overlaps('vehicle_types', driver.vehicle_types);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { items: [], nextCursor: null };

  const profiles = await fetchPublisherProfiles(supabase, rows);
  const items = rows.map(row => mapSupabaseFreight(row, profiles.get(row.publisher_id)));
  const nextCursor = rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null;

  return { items, nextCursor };
}

export function useFreights(driver: Driver | null) {
  return useInfiniteQuery({
    queryKey: ['freights', driver?.vehicle_types ?? []],
    queryFn: ({ pageParam }) => fetchFreightsPage(driver, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });
}
