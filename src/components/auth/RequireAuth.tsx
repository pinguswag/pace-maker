'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/')
    }
  }, [session, loading, router])

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}

