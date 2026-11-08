'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppShell, type ShellUser } from '@/components/layout/app-shell'
import { getSupabaseClient } from '@/lib/supabase/client'
import { fetchAll } from '@/lib/fetch-all'
import { todayStr } from '@/lib/dates'

type Challenge = { id: string; title: string; description: string | null; metric: string; goal_value: number; start_date: string; end_date: string; is_active: boolean }
type Prog = { challenge_id: string; user_id: string; current_value: number | null }
type Form = { id: string | null; title: string; description: string; metric: string; goal: string; start: string; end: string; active: boolean }

const METRICS: Record<string, { label: string; unit: string }> = {
  approved_minutes: { label: '승인된 학습 시간', unit: '분' },
  study_days: { label: '공부한 날', unit: '일' },
  approved_proofs: { label: '승인된 인증', unit: '건' },
}

export default function ChallengesPage() {
  return <AppShell>{(user) => <ChallengesContent user={user} />}</AppShell>
}

function ChallengesContent({ user }: { user: ShellUser }) {
  const isAdmin = user.role === 'admin'
  const [list, setList] = useState<Challenge[]>([])
  const [mine, setMine] = useState<Record<string, number>>({})
  const [all, setAll] = useState<Prog[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const supabase = getSupabaseClient()
    const [c, p] = await Promise.all([
      supabase.from('monthly_challenges').select('id, title, description, metric, goal_value, start_date, end_date, is_active').order('start_date', { ascending: false }),
      supabase.from('monthly_challenge_progress').select('challenge_id, user_id, current_value').eq('user_id', user.id),
    ])
    if (c.error) throw new Error(c.error.message)
    setList((c.data ?? []) as Challenge[])
    const m: Record<string, number> = {}
    ;(p.data ?? []).forEach((x: any) => { m[x.challenge_id] = Number(x.current_value ?? 0) })
    setMine(m)
    if (isAdmin) {
      const rows = (await fetchAll((a, b) => supabase.from('monthly_challenge_progress').select('challenge_id, user_id, current_value').order('challenge_id').order('user_id').range(a, b))) as Prog[]
      setAll(rows)
      const ids = [...new Set(rows.map((r) => r.user_id))]
      const map = new Map<string, string>()
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase.from('profiles').select('id, username, display_name').in('id', ids.slice(i, i + 100))
        ;(data ?? []).forEach((u: any) => map.set(u.id, u.display_name || u.username))
      }
      setNames(map)
    }
  }, [user.id, isAdmin])

  useEffect(() => { load().catch((e) => setMsg(e instanceof Error ? e.message : '불러오지 못했어요.')) }, [load])

  async function run(job: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setMsg('')
    const { error } = await job()
    if (error) setMsg(`처리하지 못했어요: ${error.message}`)
    else await load().catch(() => {})
    setBusy(false)
    return !error
  }

  async function save() {
    if (!form) return
    const goal = Number(form.goal)
    if (!form.title.trim()) return setMsg('제목을 입력해 주세요.')
    if (!Number.isInteger(goal) || goal < 1) return setMsg('목표는 1 이상의 숫자로 입력해 주세요.')
    if (!form.start || !form.end || form.end < form.start) return setMsg('시작일과 종료일을 확인해 주세요.')
    const row = { title: form.title.trim(), description: form.description.trim() || null, metric: form.metric, goal_value: goal, start_date: form.start, end_date: form.end, is_active: form.active }
    const supabase = getSupabaseClient()
    const ok = await run(() => form.id
      ? supabase.from('monthly_challenges').update(row).eq('id', form.id)
      : supabase.from('monthly_challenges').insert({ ...row, created_by: user.id }))
    if (ok) setForm(null)
  }
  const toggle = (c: Challenge) => run(() => getSupabaseClient().from('monthly_challenges').update({ is_active: !c.is_active }).eq('id', c.id))

  const today = todayStr()
  const small = 'text-xs text-neutral-500 hover:text-neutral-950'
  const field = 'h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900'
  const visible = list.filter((c) => c.is_active || isAdmin)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-neutral-400">CHALLENGE</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">월간 챌린지</h1>
        </div>
        {isAdmin && !form && <button onClick={() => setForm({ id: null, title: '', description: '', metric: 'approved_minutes', goal: '', start: today, end: today, active: true })} className="h-10 rounded-full bg-neutral-950 px-5 text-sm text-white">챌린지 만들기</button>}
      </div>
      {msg && <p role="status" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">{msg}</p>}

      {isAdmin && form && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold">{form.id ? '챌린지 수정' : '새 챌린지'}</h2>
          <input className={field} placeholder="제목" maxLength={60} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className={`${field} h-auto py-3`} rows={3} placeholder="설명 (선택)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className={field} value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
            {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.unit})</option>)}
          </select>
          <input className={field} type="number" inputMode="numeric" min={1} placeholder="목표 값" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={field} type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <input className={field} type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> 활성화</label>
          <div className="flex gap-3">
            <button disabled={busy} onClick={save} className="h-10 rounded-full bg-neutral-950 px-6 text-sm text-white disabled:opacity-50">저장</button>
            <button onClick={() => setForm(null)} className="h-10 rounded-full border border-neutral-200 px-6 text-sm">취소</button>
          </div>
        </div>
      )}

      {visible.length === 0 && <p className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">진행 중인 챌린지가 없어요.</p>}

      {visible.map((c) => {
        const m = METRICS[c.metric] ?? { label: c.metric, unit: '' }
        const cur = mine[c.id] ?? 0
        const pct = Math.min(100, Math.round((cur / c.goal_value) * 100))
        const done = cur >= c.goal_value
        const state = today < c.start_date ? '예정' : today > c.end_date ? '종료' : '진행 중'
        const rows = all.filter((r) => r.challenge_id === c.id)
        const achieved = rows.filter((r) => Number(r.current_value ?? 0) >= c.goal_value).length
        return (
          <article key={c.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{c.title}{!c.is_active && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-700">비활성</span>}</h2>
                <p className="mt-1 text-xs text-neutral-400">{c.start_date} ~ {c.end_date} · {state} · {m.label}</p>
              </div>
              {done && <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs text-white">달성</span>}
            </div>
            {c.description && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-600">{c.description}</p>}
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-neutral-950" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 text-sm tabular-nums">{cur.toLocaleString()} / {c.goal_value.toLocaleString()}{m.unit} <span className="text-neutral-400">({pct}%)</span></p>
            </div>
            {isAdmin && (
              <div className="mt-4 border-t pt-3">
                <div className="flex flex-wrap gap-4">
                  <button onClick={() => setOpen(open === c.id ? null : c.id)} className={small}>참여 현황 ({achieved}/{rows.length}명 달성)</button>
                  <button onClick={() => setForm({ id: c.id, title: c.title, description: c.description ?? '', metric: c.metric, goal: String(c.goal_value), start: c.start_date, end: c.end_date, active: c.is_active })} className={small}>수정</button>
                  <button disabled={busy} onClick={() => toggle(c)} className={small}>{c.is_active ? '비활성화' : '활성화'}</button>
                </div>
                {open === c.id && (
                  <div className="mt-3 space-y-1 text-sm">
                    {rows.length === 0 && <p className="text-neutral-500">표시할 참여자가 없어요. (활성 챌린지만 집계돼요)</p>}
                    {[...rows].sort((a, b) => Number(b.current_value ?? 0) - Number(a.current_value ?? 0)).map((r) => (
                      <div key={r.user_id} className="flex justify-between"><span>{names.get(r.user_id) ?? '알 수 없음'}</span><span className="tabular-nums text-neutral-600">{Number(r.current_value ?? 0).toLocaleString()}{m.unit}</span></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

