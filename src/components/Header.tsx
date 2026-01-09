'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase/client'
import { t } from '@/lib/uiText/ko'

export function Header() {
  const { session } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>
      <div>Pace Maker</div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <a href="/today" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.today}</a>
        <a href="/mandarat" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.mandarat}</a>
        <a href="/projects" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.projects}</a>
        <a href="/weekly" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.weekly}</a>
        <a href="/review" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.review}</a>
        <a href="/routines" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.routines}</a>
        {session && (
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {t.nav.logout}
          </button>
        )}
      </div>
    </header>
  )
}
