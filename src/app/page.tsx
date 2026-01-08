'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/components/auth/AuthProvider'
import { t } from '@/lib/uiText/ko'
import { getProjects, getMonthlyFocus } from '@/lib/mockStore'
import { getMonthKey } from '@/lib/keys'

type AuthMode = 'login' | 'signup'

export default function HomePage() {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 세션이 있으면 상태 기반 리다이렉트
  useEffect(() => {
    if (!loading && session) {
      const redirectBasedOnState = async () => {
        try {
          const userId = session.user.id

          // 1. Mandarat 확인
          const { data: boardData, error: boardError } = await supabase
            .from('mandarat_boards')
            .select('id, yearly_goal')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle()

          // board가 없거나 yearly_goal이 비어있으면 Mandarat으로
          if (!boardData || !boardData.yearly_goal?.trim()) {
            router.replace('/mandarat')
            return
          }

          // Strategies와 Actions 확인
          const { data: strategiesData } = await supabase
            .from('mandarat_strategies')
            .select('text_value')
            .eq('board_id', boardData.id)
            .limit(8)

          const { data: actionsData } = await supabase
            .from('mandarat_actions')
            .select('text_value')
            .eq('board_id', boardData.id)
            .limit(1)

          const hasMandaratData = 
            (strategiesData && strategiesData.some(s => s.text_value?.trim())) ||
            (actionsData && actionsData.some(a => a.text_value?.trim()))

          if (!hasMandaratData) {
            router.replace('/mandarat')
            return
          }

          // 2. 프로젝트 확인
          const projects = getProjects()
          if (!projects || projects.length === 0) {
            router.replace('/projects/new')
            return
          }

          // 3. Monthly Focus 확인
          const currentMonthKey = getMonthKey(new Date())
          const focus = getMonthlyFocus()
          if (!focus || focus.monthKey !== currentMonthKey || !focus.projectIds || focus.projectIds.length === 0) {
            router.replace('/focus')
            return
          }

          // 4. 그 외 → /weekly
          router.replace('/weekly')
        } catch (err) {
          // 에러 발생 시 기본적으로 /mandarat로 리다이렉트
          console.error('Failed to check app state:', err)
          router.replace('/mandarat')
        }
      }

      redirectBasedOnState()
    }
  }, [session, loading, router])

  // 로딩 중이면 로딩 화면 표시
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{t.common.loading}</p>
      </div>
    )
  }

  // 세션이 있으면 아무것도 렌더링하지 않음 (리다이렉트 중)
  if (session) {
    return null
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          setAuthLoading(false)
          return
        }

        router.replace('/today')
      } else {
        // Sign up
        const { error: signUpError, data } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          setError(signUpError.message)
          setAuthLoading(false)
          return
        }

        // 이메일 확인이 필요한 경우
        if (data.user && !data.session) {
          setSuccessMessage('이메일을 확인해주세요. 인증 링크를 보내드렸습니다.')
          setEmail('')
          setPassword('')
        } else if (data.session) {
          // 자동 로그인된 경우
          router.replace('/today')
        }
      }
    } catch (err) {
      setError(mode === 'login' ? '로그인 중 오류가 발생했습니다.' : '회원가입 중 오류가 발생했습니다.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setAuthLoading(true)
    setError(null)

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/today`,
        },
      })

      if (oauthError) {
        setError(oauthError.message || `${provider} 로그인을 사용할 수 없습니다.`)
        setAuthLoading(false)
      }
      // OAuth는 리다이렉트되므로 여기서는 로딩 상태를 유지
    } catch (err) {
      setError(`${provider} 로그인 중 오류가 발생했습니다.`)
      setAuthLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        backgroundColor: '#f5f5f5',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '2rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ marginBottom: '2rem', textAlign: 'center', fontSize: '1.5rem' }}>{t.pages.homeTitle}</h1>

        {/* 모드 토글 버튼 */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '2rem',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
              setSuccessMessage(null)
            }}
            disabled={authLoading}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              borderBottom: mode === 'login' ? '2px solid #0070f3' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: mode === 'login' ? '#0070f3' : '#666',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              fontWeight: mode === 'login' ? '600' : '400',
            }}
          >
            {t.messages.login}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError(null)
              setSuccessMessage(null)
            }}
            disabled={authLoading}
            style={{
              flex: 1,
              padding: '0.75rem',
              border: 'none',
              borderBottom: mode === 'signup' ? '2px solid #0070f3' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: mode === 'signup' ? '#0070f3' : '#666',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              fontWeight: mode === 'signup' ? '600' : '400',
            }}
          >
            {t.messages.signup}
          </button>
        </div>

        {/* 이메일/비밀번호 폼 */}
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              {t.messages.email}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>
          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              {t.messages.password}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={authLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>

          {error && (
            <div style={{ color: '#dc3545', fontSize: '0.875rem', padding: '0.5rem', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{ color: '#155724', fontSize: '0.875rem', padding: '0.5rem', backgroundColor: '#d4edda', borderRadius: '4px' }}>
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            style={{
              padding: '0.75rem',
              backgroundColor: authLoading ? '#e0e0e0' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            {authLoading ? (mode === 'login' ? t.messages.loggingIn : t.messages.signingUp) : mode === 'login' ? t.messages.login : t.messages.signup}
          </button>
        </form>

        {/* 소셜 로그인 구분선 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '1.5rem 0',
            gap: '0.75rem',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }} />
          <span style={{ color: '#666', fontSize: '0.875rem' }}>또는</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e0e0e0' }} />
        </div>

        {/* 소셜 로그인 버튼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={authLoading}
            style={{
              padding: '0.75rem',
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <span>🔵</span>
            <span>{t.messages.continueWithGoogle}</span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('kakao')}
            disabled={authLoading}
            style={{
              padding: '0.75rem',
              backgroundColor: '#FEE500',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontWeight: '500',
            }}
          >
            <span>💬</span>
            <span>{t.messages.continueWithKakao}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
