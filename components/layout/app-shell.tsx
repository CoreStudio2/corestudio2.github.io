'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, ShieldCheck } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

export type ShellUser = { id: string; username: string; display_name: string | null; role: string }

const NAV = [
  { href: '/', label: '홈' },
  { href: '/study', label: '학습 기록' },
]

export function AppShell({ children }: { children: (user: ShellUser) => ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<ShellUser | null>(null)

  useEffect(() => {
    const supabase = getSupabaseClient()
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) return router.replace('/login')
      const { data: p } = await supabase
        .from('profiles')
        .select('id, username, display_name, role, is_suspended')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!p || p.is_suspended) {
        await supabase.auth.signOut()
        alert('이용할 수 없는 계정입니다. 관리자에게 문의해 주세요.')
        return router.replace('/login')
      }
      setUser(p as ShellUser)
    })().catch(() => router.replace('/login'))
  }, [router])

  async function logout() {
    await getSupabaseClient().auth.signOut()
    router.replace('/login')
  }

  if (!user) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#fafafa] text-sm text-neutral-500">
        불러오는 중이에요.
      </main>
    )
  }

  return (
    <div className="min-h-svh bg-[#fafafa] text-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/" className="text-base font-semibold tracking-[0.32em]">ANANTHEO</Link>
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={`rounded-full px-3 py-2 ${pathname === n.href ? 'bg-neutral-950 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
                {n.label}
              </Link>
            ))}
            {user.role === 'admin' && (
              <Link href="/admin" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-neutral-500 hover:bg-neutral-100">
                <ShieldCheck size={14} /> 관리자
              </Link>
            )}
            <button onClick={logout} aria-label="로그아웃" className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100">
              <LogOut size={16} />
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-9 sm:px-8">{children(user)}</main>
    </div>
  )
}

