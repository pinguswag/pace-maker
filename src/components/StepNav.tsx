'use client'

import { useRouter } from 'next/navigation'

interface StepNavProps {
  prev?: {
    href: string
    label?: string
  }
  next?: {
    href: string
    label?: string
    disabled?: boolean
    hint?: string
  }
}

export function StepNav({ prev, next }: StepNavProps) {
  const router = useRouter()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'flex-end',
      }}
    >
      {next?.hint && next.disabled && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#666',
            backgroundColor: '#fff',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            maxWidth: '200px',
            textAlign: 'right',
            marginBottom: '0.25rem',
          }}
        >
          {next.hint}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {prev && (
          <button
            onClick={() => router.push(prev.href)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            {prev.label || '← 이전 단계'}
          </button>
        )}
        {next && (
          <button
            onClick={() => !next.disabled && router.push(next.href)}
            disabled={next.disabled}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: next.disabled ? '#e0e0e0' : '#0070f3',
              color: next.disabled ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: next.disabled ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
          >
            {next.label || '다음 단계 →'}
          </button>
        )}
      </div>
    </div>
  )
}
