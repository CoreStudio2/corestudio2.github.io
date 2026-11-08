// Supabase는 한 번에 최대 1000줄만 주기 때문에 나눠서 전부 가져옵니다.
export async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>,
): Promise<any[]> {
  const size = 1000
  const out: any[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return out
}

