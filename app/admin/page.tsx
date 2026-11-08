'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock3, RefreshCw, ShieldCheck, Users, X } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  username: string
  display_name: string | null
  role: string
  is_suspended: boolean
  created_at: string
}
type StudyEntry = {
  id: string
  user_id: string
  study_date: string
  minutes: number
  memo: string | null
  status: string
  created_at: string
}
type Tab = 'pending' | 'members'

const fmtDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
const fmtMinutes = (value: number) => `${Math.floor(value / 60) ? `${Math.floor(value / 60)}시간 ` : ''}${value % 60}분`

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pending')
  const [checking, setChecking] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [entries, setEntries] = useState<StudyEntry[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])

  const loadData = useCallback(async () => {
    setError('')
    const supabase = getSupabaseClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      router.replace('/login')
      return
    }
    const { data: me, error: meError } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
    if (meError || me?.role !== 'admin') {
      setChecking(false)
      setError('관리자 권한을 확인할 수 없습니다. 관리자 계정으로 다시 로그인해 주세요.')
      return
    }

    const [entryResult, profileResult] = await Promise.all([
      supabase.from('study_entries').select('id,user_id,study_date,minutes,memo,status,created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      supabase.from('profiles').select('id,username,display_name,role,is_suspended,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(200),
    ])
    if (entryResult.error) setError(`학습 기록을 불러오지 못했습니다: ${entryResult.error.message}`)
    if (profileResult.error) setError((current) => current || `회원 목록을 불러오지 못했습니다: ${profileResult.error.message}`)
    setEntries((entryResult.data ?? []) as StudyEntry[])
    setProfiles((profileResult.data ?? []) as Profile[])
    setChecking(false)
  }, [router])

  useEffect(() => { loadData().catch((e) => { setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.'); setChecking(false) }) }, [loadData])

  async function review(entry: StudyEntry, status: 'approved' | 'rejected') {
    const supabase = getSupabaseClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) { router.replace('/login'); return }
    setBusyId(entry.id)
    setError('')
    setNotice('')
    const { error: updateError } = await supabase.from('study_entries').update({
      status,
      reviewed_by: authData.user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', entry.id).eq('status', 'pending')
    setBusyId(null)
    if (updateError) {
      setError(`처리하지 못했습니다: ${updateError.message}`)
      return
    }
    setEntries((current) => current.filter((item) => item.id !== entry.id))
    setNotice(status === 'approved' ? '학습 기록을 승인했습니다.' : '학습 기록을 반려했습니다.')
  }

  if (checking) return <main className="flex min-h-svh items-center justify-center bg-neutral-50 text-sm text-neutral-500">관리자 권한을 확인하고 있어요.</main>

  return (
    <main className="min-h-svh bg-neutral-50 text-neutral-950">
      <header className="border-b bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <a href="/" className="text-base font-semibold tracking-[0.32em]">ANANTHEO</a>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs"><ShieldCheck size={14} /> ADMIN</span>
            <button onClick={() => router.push('/')} className="text-sm text-neutral-500">메인으로</button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="text-xs tracking-[0.2em] text-neutral-400">ADMINISTRATION</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-semibold">관리자 대시보드</h1><p className="mt-2 text-sm text-neutral-500">회원과 학습 기록을 확인하고 관리합니다.</p></div>
          <button onClick={() => { setChecking(true); loadData().finally(() => setChecking(false)) }} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-sm"><RefreshCw size={14}/> 새로고침</button>
        </div>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">{notice}</p>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-2 text-sm text-neutral-500"><Clock3 size={16}/> 승인 대기 학습 기록</div><p className="mt-3 text-3xl font-semibold tabular-nums">{entries.length}건</p></div>
          <div className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-2 text-sm text-neutral-500"><Users size={16}/> 등록 회원</div><p className="mt-3 text-3xl font-semibold tabular-nums">{profiles.filter((p) => p.role !== 'admin').length}명</p></div>
        </div>
        <div className="mt-8 flex gap-2 border-b">
          <button onClick={() => setTab('pending')} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === 'pending' ? 'border-neutral-950' : 'border-transparent text-neutral-400'}`}>학습 승인 ({entries.length})</button>
          <button onClick={() => setTab('members')} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === 'members' ? 'border-neutral-950' : 'border-transparent text-neutral-400'}`}>회원 관리 ({profiles.length})</button>
        </div>
        {tab === 'pending' ? (
          <div className="mt-5 space-y-3">
            {entries.length === 0 ? <div className="rounded-2xl border bg-white px-6 py-12 text-center text-sm text-neutral-500">현재 승인 대기 중인 학습 기록이 없습니다.</div> : entries.map((entry) => {
              const profile = profileById.get(entry.user_id)
              return <article key={entry.id} className="rounded-2xl border bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="font-semibold">{profile?.display_name || profile?.username || '회원'}</p><p className="mt-1 text-xs text-neutral-400">{profile?.username ? `@${profile.username} · ` : ''}{fmtDate(entry.study_date)} · {fmtMinutes(entry.minutes)}</p>{entry.memo && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600">{entry.memo}</p>}<p className="mt-2 text-xs text-neutral-300">제출 {fmtDate(entry.created_at)}</p></div>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs text-amber-700">승인 대기</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button disabled={busyId === entry.id} onClick={() => review(entry, 'approved')} className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm text-white disabled:opacity-50"><Check size={15}/> 승인</button>
                  <button disabled={busyId === entry.id} onClick={() => review(entry, 'rejected')} className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm disabled:opacity-50"><X size={15}/> 반려</button>
                </div>
              </article>
            })}
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border bg-white">
            {profiles.length === 0 ? <p className="p-8 text-center text-sm text-neutral-500">표시할 회원이 없습니다.</p> : <div className="divide-y">{profiles.map((p) => <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{p.display_name || p.username}</p><p className="mt-1 text-xs text-neutral-400">@{p.username} · 가입 {fmtDate(p.created_at)}</p></div><div className="flex items-center gap-2">{p.role === 'admin' && <span className="rounded-full border px-2.5 py-1 text-xs">관리자</span>}<span className={`rounded-full px-2.5 py-1 text-xs ${p.is_suspended ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-600'}`}>{p.is_suspended ? '정지' : '정상'}</span></div></div>)}</div>}
          </div>
        )}
        <p className="mt-8 text-xs leading-5 text-neutral-400">회원 상태는 조회 전용입니다. 계정 정지·삭제 및 포인트 변경은 별도 권한과 처리 규칙을 확인한 뒤 연결합니다.</p>
      </section>
    </main>
  )
}
