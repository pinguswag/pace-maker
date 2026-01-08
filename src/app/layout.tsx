import { AuthProvider } from '@/components/auth/AuthProvider'
import { t } from '@/lib/uiText/ko'

export const metadata = {
  title: 'Pace Maker',
  description: 'Pace Maker Application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #e0e0e0' }}>
            <div>Pace Maker</div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="/today" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.today}</a>
              <a href="/mandarat" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.mandarat}</a>
              <a href="/projects" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.projects}</a>
              <a href="/weekly" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.weekly}</a>
              <a href="/review" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.review}</a>
              <a href="/routines" style={{ color: 'inherit', textDecoration: 'none' }}>{t.nav.routines}</a>
            </div>
          </header>
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}

