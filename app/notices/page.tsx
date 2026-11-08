'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppShell, type ShellUser } from '@/components/layout/app-shell'
import { getSupabaseClient } from '@/lib/supabase/client'
import { fetchAll } from '@/lib/fetch-all'

type Notice = { id: string; title: string; body: string; is_published: boolean; published_at: string | null; created_at: string }
type Form = { id: string | null; title: string; body: string; publish: boolean }

const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '')

export default function NoticesPage() {
  return <AppShell>{(user) => <NoticesContent user={user} />}</AppShell>
}

function NoticesContent({ user }: { user: ShellUser }) {
  const isAdmin = user.role === 'admin'
  const [notices, setNotices] = useState<Notice[]>([])
  const [read, setRead] = useState<Set<string>>(new Set())
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const supabase = getSupabaseClient()
    const [n, r] = await Promise.all([
      supabase.from('announcements').select('id, title, body, is_published, published_at, created_at').order('created_at', { ascending: false }),
      supabase.from('announcement_reads').select('announcement_id').eq('user_id', user.id),
    ])
    if (n.error) throw new Error(n.error.message)
    setNotices((n.data ?? []) as Notice[])
    setRead(new Set((r.data ?? []).map((x: any) => x.announcement_id as string)))
    if (isAdmin) {
      const all = await fetchAll((a, b) => supabase.from('announcement_reads').select('announcement_id, user_id').order('announcement_id').order('user_id').range(a, b))
      const c: Record<string, number> = {}
      all.forEach((x) => { c[x.announcement_id] = (c[x.announcement_id] ?? 0) + 1 })
      setCounts(c)
    }
  }, [user.id, isAdmin])

  useEffect(() => { load().catch((e) => setMsg(e instanceof Error ? e.message : '불러오지 못했어요.')) }, [load])

  async function toggleOpen(n: Notice) {
    setOpen(open === n.id ? null : n.id)
    if (open !== n.id && n.is_published && !read.has(n.id)) {
      await getSupabaseClient().from('announcement_reads').insert({ announcement_id: n.id, user_id: user.id })
      setRead(new Set([...read, n.id]))
    }
  }

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
    const title = form.title.trim(); const body = form.body.trim()
    if (!title || !body) return setMsg('제목과 내용을 입력해 주세요.')
    const supabase = getSupabaseClient()
    const now = new Date().toISOString()
    const old = notices.find((x) => x.id === form.id)
    const published_at = form.publish ? old?.published_at ?? now : old?.published_at ?? null
    const ok = await run(() => form.id
      ? supabase.from('announcements').update({ title, body, is_published: form.publish, published_at, updated_at: now }).eq('id', form.id)
      : supabase.from('announcements').insert({ title, body, is_published: form.publish, published_at, created_by: user.id }))
    if (ok) setForm(null)
  }
  const togglePublish = (n: Notice) => {
    const now = new Date().toISOString()
    return run(() => getSupabaseClient().from('announcements').update({ is_published: !n.is_published, published_at: n.published_at ?? now, updated_at: now }).eq('id', n.id))
  }
  const remove = (n: Notice) => confirm('이 공지를 삭제할까요?') && run(() => getSupabaseClient().from('announcements').delete().eq('id', n.id))

  const unread = notices.filter((n) => n.is_published && !read.has(n.id)).length
  const small = 'text-xs text-neutral-500 hover:text-neutral-950'
  const field = 'w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-neutral-400">NOTICES</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">공지사항</h1>
          <p className="mt-2 text-sm text-neutral-500">{unread ? `읽지 않은 공지가 ${unread}개 있어요.` : '모든 공지를 확인했어요.'}</p>
        </div>
        {isAdmin && !form && <button onClick={() => setForm({ id: null, title: '', body: '', publish: true })} className="h-10 rounded-full bg-neutral-950 px-5 text-sm text-white">공지 작성</button>}
      </div>
      {msg && <p role="status" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">{msg}</p>}

      {isAdmin && form && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="font-semibold">{form.id ? '공지 수정' : '새 공지'}</h2>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} placeholder="제목" className={`${field} h-11`} />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} placeholder="내용" className={`${field} py-3`} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} /> 바로 게시하기</label>
          <div className="flex gap-3">
            <button disabled={busy} onClick={save} className="h-10 rounded-full bg-neutral-950 px-6 text-sm text-white disabled:opacity-50">저장</button>
            <button onClick={() => setForm(null)} className="h-10 rounded-full border border-neutral-200 px-6 text-sm">취소</button>
          </div>
        </div>
      )}

      {notices.length === 0 && <p className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">등록된 공지가 없어요.</p>}

      <div className="divide-y rounded-2xl border border-neutral-200 bg-white">
        {notices.map((n) => {
          const isNew = n.is_published && !read.has(n.id)
          return (
            <div key={n.id} className="px-5 py-4">
              <button onClick={() => toggleOpen(n)} className="flex w-full items-start justify-between gap-3 text-left">
                <span>
                  <span className="text-sm font-medium">{n.title}</span>
                  {isNew && <span className="ml-2 rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] text-white">NEW</span>}
                  {!n.is_published && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">비공개</span>}
                  <span className="mt-1 block text-xs text-neutral-400">{day(n.published_at ?? n.created_at)}{isAdmin ? ` · 읽음 ${counts[n.id] ?? 0}명` : ''}</span>
                </span>
              </button>
              {open === n.id && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{n.body}</p>}
              {isAdmin && (
                <div className="mt-3 flex gap-4">
                  <button onClick={() => setForm({ id: n.id, title: n.title, body: n.body, publish: n.is_published })} className={small}>수정</button>
                  <button disabled={busy} onClick={() => togglePublish(n)} className={small}>{n.is_published ? '게시 취소' : '게시'}</button>
                  <button disabled={busy} onClick={() => remove(n)} className={small}>삭제</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

