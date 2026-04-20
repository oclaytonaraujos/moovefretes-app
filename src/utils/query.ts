type SupabaseResult<T> = { data: T | null; error: { message: string } | null };

export async function safeQuery<T>(
  fn: () => Promise<SupabaseResult<T>>,
  fallback: T,
): Promise<{ data: T; error: string | null }> {
  try {
    const { data, error } = await fn();
    if (error) return { data: fallback, error: error.message };
    return { data: data ?? fallback, error: null };
  } catch (e: any) {
    return { data: fallback, error: e?.message ?? 'Erro de conexão. Verifique sua internet.' };
  }
}
