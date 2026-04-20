import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useFreights } from '../useFreights';

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      overlaps: jest.fn().mockReturnThis(),
      lt: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useFreights', () => {
  it('retorna lista vazia quando não há fretes', async () => {
    const { result } = renderHook(() => useFreights(null), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const items = result.current.data?.pages.flatMap(p => p.items) ?? [];
    expect(items).toHaveLength(0);
  });

  it('inicia sem próxima página quando sem dados', async () => {
    const { result } = renderHook(() => useFreights(null), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });
});
