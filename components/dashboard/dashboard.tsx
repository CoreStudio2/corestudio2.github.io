'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase/client'

type Profile = {
  username: string
  display_name: string | null
  role: string
}
type MonthlyReport = {
  approved_minutes: number | null
  study_days: number | null
  approved_entry_count: number | null
}
type Challenge = {
  challenge_id: string
  challenge_title: string
  metric: string
  goal_value: number
  current_value: number
  end_date: string
}

const number = (value: number | null | undefined) =>
  new Intl.NumberFormat('ko-KR').format(value ?? 0)

const minutesLabel = (value: number) => {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  if (hours === 0) return `${minutes}분`
  if (minutes === 0) return `${hours}시간`
  return `${hours}시간 ${minutes}분`
}

export function Dashboard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [points, setPoints] = useState(0)
  const [warnings, setWarnings] = useState<{ warning_count: number; warning_limit: number } | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(new Date()),
    [],
  )

  const loadDashboard = useCallback(async () => {
    const supabase = getSupabaseClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      router.replace('/login')
      return
    }
    setSession((await supabase.auth.getSession()).data.session)

    const monthStart = new Date()
    monthStart.setDate(1)
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`
    const userId = authData.user.id

    const [profileResult, reportResult, pointResult, warningResult, challengeResult] = await Promise.all([
      supabase.from('profiles').select('username, display_name, role').eq('id', userId).maybeSingle(),
      supabase.from('monthly_study_reports').select('approved_minutes, study_days, approved_entry_count').eq('user_id', userId).eq('month_start', monthKey).maybeSingle(),
      supabase.from('participant_point_balances').select('total_points').eq('user_id', userId).maybeSingle(),
      supabase.from('participant_warning_balances').select('warning_count, warning_limit').eq('user_id', userId).maybeSingle(),
      supabase.from('monthly_challenge_progress').select('challenge_id, challenge_title, metric, goal_value, current_value, end_date').eq('user_id', userId),
    ])

    if (profileResult.error) setError('프로필 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.')
    setProfile(profileResult.data as Profile | null)
    setReport(reportResult.data as MonthlyReport | null)
    setPoints(pointResult.data?.total_points ?? 0)
    setWarnings(warningResult.data)
    setChallenges((challengeResult.data ?? []) as Challenge[])
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadDashboard().catch(() => {
      setError('정보를 불러오는 중 문제가 발생했습니다. 새로고침해 주세요.')
      setLoading(false)
    })
  }, [loadDashboard])

  async function logout() {
    await getSupabaseClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#fafafa] px-6">
        <div className="text-center">
          <p className="text-sm font-semibold tracking-[0.35em]">ANANTHEO</p>
          <p className="mt-3 text-sm text-neutral-500">나의 기록을 불러오고 있어요.</p>
        </div>
      </main>
    )
  }

  const displayName = profile?.display_name || profile?.username || session?.user.email || '회원'
  const challengePercent = (challenge: Challenge) =>
    challenge.goal_value > 0 ? Math.min(100, Math.round((challenge.current_value / challenge.goal_value) * 100)) : 0

  return (
    <main className="min-h-svh bg-[#fafafa] text-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="/" className="text-base font-semibold tracking-[0.32em]">ANANTHEO</a>
          <div className="flex items-center gap-3">
            <a href="/study" className="rounded-full px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100">학습 기록</a>
            <a href="/ranking" className="rounded-full px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100">랭킹</a>
            <a href="/calendar" className="rounded-full px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100">달력</a>
            <a href="/stats" className="rounded-full px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100">통계</a>
            <a href="/community" className="rounded-full px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100">커뮤니티</a>
            <a href="/notices" className="rounded-full px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100">공지</a>
            {profile?.role === 'admin' && (
              <a href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-2 text-xs font-medium hover:bg-neutral-50">
                <ShieldCheck size={14} /> 관리자
              </a>
            )}
            <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-9 sm:px-8 sm:pt-12">
        <section className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-medium tracking-[0.22em] text-neutral-400">YOUR GROWTH, YOUR RECORD</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">다시 피어나는 하루,</h1>
            <p className="mt-2 text-lg text-neutral-500">{displayName}님, 오늘도 한 걸음 나아가요.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <CalendarDays size={16} /> {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date())}
          </div>
        </section>

        {error && <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Clock3 size={18} />} label="이번 달 승인 학습 시간" value={minutesLabel(report?.approved_minutes ?? 0)} detail={monthLabel} />
          <StatCard icon={<Flame size={18} />} label="이번 달 학습일" value={`${number(report?.study_days)}일`} detail="꾸준함이 실력이 돼요" />
          <StatCard icon={<Trophy size={18} />} label="보유 포인트" value={`${number(points)}P`} detail="승인된 학습 기록 기준" />
          <StatCard icon={<ShieldCheck size={18} />} label="누적 경고" value={`${number(warnings?.warning_count)} / ${number(warnings?.warning_limit ?? 5)}`} detail="차분하게 규칙을 지켜요" />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-[0.18em] text-neutral-400">MONTHLY CHALLENGE</p>
                <h2 className="mt-2 text-xl font-semibold">이달의 챌린지</h2>
              </div>
              <Sparkles className="text-neutral-400" size={21} />
            </div>
            {challenges.length ? (
              <div className="mt-6 space-y-6">
                {challenges.map((challenge) => (
                  <div key={challenge.challenge_id}>
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{challenge.challenge_title}</p>
                        <p className="mt-1 text-xs text-neutral-400">목표 {number(challenge.goal_value)} · 종료 {challenge.end_date}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{challengePercent(challenge)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${challengePercent(challenge)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">현재 {number(challenge.current_value)} / {number(challenge.goal_value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-xl bg-neutral-50 px-5 py-8 text-center">
                <p className="text-sm text-neutral-500">진행 중인 챌린지가 아직 없어요.</p>
                <p className="mt-1 text-xs text-neutral-400">새로운 챌린지가 시작되면 여기에 표시돼요.</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-neutral-950 p-6 text-white sm:p-8">
            <p className="text-xs font-medium tracking-[0.18em] text-neutral-400">A SMALL REMINDER</p>
            <div className="mt-7 flex h-full flex-col">
              <BookOpen size={22} className="text-neutral-400" />
              <p className="mt-5 text-2xl font-medium leading-relaxed">나는<br />다시 피어난다.</p>
              <p className="mt-3 text-sm leading-6 text-neutral-400">완벽하지 않아도 괜찮아요.<br />오늘의 작은 기록이 내일의 나를 만듭니다.</p>
              <div className="mt-8 border-t border-white/15 pt-5 text-xs tracking-wide text-neutral-400">ANANTHEO · GROW AT YOUR PACE</div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <QuickLink icon={<CheckCircle2 size={18} />} title="학습 기록" description="공부한 시간을 기록하고 인증을 제출해요." />
          <QuickLink icon={<MessageCircle size={18} />} title="커뮤니티" description="서로의 노력과 응원을 나눠요." />
          <QuickLink icon={<UserRound size={18} />} title="내 프로필" description="나의 계정과 활동을 확인해요." />
        </section>
        <p className="mt-8 text-center text-xs text-neutral-400">승인된 기록 {number(report?.approved_entry_count)}건 · ANANTHEO</p>
      </div>
    </main>
  )
}

function StatCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2 text-neutral-400">{icon}<span className="text-xs">{label}</span></div>
      <p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{detail}</p>
    </div>
  )
}

function QuickLink({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2 font-medium">{icon}{title}</div>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
      <div className="mt-4 flex items-center gap-1 text-xs text-neutral-400">다음 개발 단계 <ArrowRight size={13} /></div>
    </div>
  )
}

