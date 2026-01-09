'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Session } from '@supabase/supabase-js'
import { validateAndRepairMockData } from '@/lib/validateMockData'
import { ensureProfileExists } from '@/lib/profiles'

interface AuthContextType {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    // 브라우저에서만 데이터 검증 실행
    if (typeof window !== 'undefined') {
      const result = validateAndRepairMockData()
      if (result.repaired && result.notes.length > 0) {
        console.log('Data validation repaired issues:', result.notes)
      }
    }

    // Helper to ensure profile exists (non-blocking)
    const ensureProfileForSession = async (session: Session | null) => {
      if (!isMounted || !session?.user?.id) return
      
      try {
        await ensureProfileExists(session.user.id)
      } catch (err) {
        // Log but don't block auth flow
        console.error('Failed to ensure profile exists (non-fatal):', err)
      }
    }

    // 초기 세션 가져오기
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return
      
      setSession(session)
      setLoading(false)
      
      // Ensure profile asynchronously (don't block)
      ensureProfileForSession(session).catch(() => {
        // Already logged in ensureProfileForSession
      })
    })

    // 인증 상태 변경 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      
      setSession(session)
      setLoading(false)
      
      // Ensure profile asynchronously (don't block)
      ensureProfileForSession(session).catch(() => {
        // Already logged in ensureProfileForSession
      })
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

