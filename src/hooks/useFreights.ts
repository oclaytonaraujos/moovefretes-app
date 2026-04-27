import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { mapSupabaseFreight, fetchPublisherProfiles } from '../utils/helpers';

const PAGE_SIZE = 20;

async function fetchFreightsPage(publisherId: string | null, cursor: string | null) {
  if (!publisherId) return { items: [], nextCursor: null };

  let query = supabase
    .from('freights')
    .select('*')
    .eq('publisher_id', publisherId)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

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

async function fetchAllFreightsPage(cursor: string | null) {
  let query = supabase
    .from('freights')
    .select('*')
    .in('status', ['active', 'scheduled'])
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

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

export function useFreights(publisherId: string | null) {
  return useInfiniteQuery({
    queryKey: ['freights', publisherId],
    queryFn: ({ pageParam }) => fetchFreightsPage(publisherId, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });
}

export function useAllFreights() {
  return useInfiniteQuery({
    queryKey: ['freights', 'all'],
    queryFn: ({ pageParam }) => fetchAllFreightsPage(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  });
}
