import { AuthProvider } from '@/components/auth/AuthProvider'
import { Header } from '@/components/Header'

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
          <Header />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}

