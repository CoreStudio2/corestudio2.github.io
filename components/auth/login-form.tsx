'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSupabaseClient } from '@/lib/supabase/client'
import { LoginError, requestUsernameLogin } from '@/lib/auth/username-login'

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      alert('아이디와 비밀번호를 모두 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      const { session, profile } = await requestUsernameLogin(trimmedUsername, password)

      const supabase = getSupabaseClient()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      if (sessionError) {
        throw new LoginError(`세션 저장에 실패했습니다: ${sessionError.message}`)
      }

      router.replace(profile.role === 'admin' ? '/admin' : '/')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">아이디</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="아이디를 입력하세요"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isSubmitting}
          required
          className="h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          required
          className="h-11"
        />
      </div>
      <Button type="submit" size="lg" className="mt-2 h-11" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            로그인 중...
          </>
        ) : (
          '로그인'
        )}
      </Button>
    </form>
  )
}

