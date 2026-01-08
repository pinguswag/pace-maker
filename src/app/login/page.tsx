'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { t } from '@/lib/uiText/ko'

export default function LoginPage() {
  const router = useRouter()
  const { session, loading } = useAuth()

  // 세션이 있으면 /today로, 없으면 "/"로 리다이렉트
  useEffect(() => {
    if (!loading) {
      if (session) {
        router.replace('/today')
      } else {
        router.replace('/')
      }
    }
  }, [session, loading, router])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>{t.messages.redirecting}</p>
    </div>
  )
}
