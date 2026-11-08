import { SUPABASE_URL } from '@/lib/supabase/client'

const LOGIN_ENDPOINT = `${SUPABASE_URL}/functions/v1/username-login`
const REQUEST_TIMEOUT_MS = 15000

export type LoginProfile = {
  role?: string
  [key: string]: unknown
}

export type LoginSession = {
  access_token: string
  refresh_token: string
  [key: string]: unknown
}

export type LoginResponse = {
  error?: string | { message?: string }
  session?: LoginSession
  profile?: LoginProfile
}

export class LoginError extends Error {}

function extractErrorMessage(error: LoginResponse['error']): string {
  if (!error) return '로그인에 실패했습니다.'
  if (typeof error === 'string') return error
  return error.message ?? '로그인에 실패했습니다.'
}

export async function requestUsernameLogin(
  username: string,
  password: string,
): Promise<{ session: LoginSession; profile: LoginProfile }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new LoginError('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.')
    }
    throw new LoginError(
      '서버에 연결할 수 없습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.',
    )
  } finally {
    clearTimeout(timeoutId)
  }

  let data: LoginResponse
  try {
    const text = await response.text()
    data = text ? (JSON.parse(text) as LoginResponse) : {}
  } catch {
    throw new LoginError(`서버 응답을 해석할 수 없습니다. (HTTP ${response.status})`)
  }

  if (data.error) {
    throw new LoginError(extractErrorMessage(data.error))
  }
  if (!response.ok) {
    throw new LoginError(`로그인 요청이 실패했습니다. (HTTP ${response.status})`)
  }
  if (!data.session?.access_token || !data.session?.refresh_token) {
    throw new LoginError('로그인 응답에 세션 정보가 없습니다.')
  }

  return { session: data.session, profile: data.profile ?? {} }
}

