'use client'

import { useState, useEffect } from 'react'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { t } from '@/lib/uiText/ko'
import { getRoutines as getStoredRoutines, setRoutines as saveRoutines } from '@/lib/mockStore'

// Routine 타입 정의
interface Routine {
  id: string
  title: string
  cadence: 'daily' | 'weekly'
  weeklyDays?: number[] // 0-6 (Mon-Sun), only if cadence=weekly
  active: boolean
  created_at: string
}

// Routines 저장 형식
interface RoutinesData {
  routines: Routine[]
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function RoutinesPageContent() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newCadence, setNewCadence] = useState<'daily' | 'weekly'>('daily')
  const [newWeeklyDays, setNewWeeklyDays] = useState<number[]>([])
  const [newActive, setNewActive] = useState(true)

  // 루틴 로드
  useEffect(() => {
    try {
      const parsed = getStoredRoutines()
      setRoutines(Array.isArray(parsed.routines) ? parsed.routines : [])
    } catch (err) {
      console.error('Failed to load routines from localStorage:', err)
      setRoutines([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 루틴 저장
  const persistRoutines = (updatedRoutines: Routine[]) => {
    try {
      const data: RoutinesData = { routines: updatedRoutines }
      saveRoutines(data)
      setRoutines(updatedRoutines)
    } catch (err) {
      console.error('Failed to save routines to localStorage:', err)
    }
  }

  // 루틴 추가
  const handleAddRoutine = () => {
    const title = newTitle.trim()
    if (!title) return

    const newRoutine: Routine = {
      id: `routine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      cadence: newCadence,
      weeklyDays: newCadence === 'weekly' ? newWeeklyDays : undefined,
      active: newActive,
      created_at: new Date().toISOString(),
    }

    const updated = [...routines, newRoutine]
    persistRoutines(updated)

    // 폼 리셋
    setNewTitle('')
    setNewCadence('daily')
    setNewWeeklyDays([])
    setNewActive(true)
  }

  // 루틴 활성 상태 토글
  const handleToggleActive = (id: string) => {
    const updated = routines.map((r) =>
      r.id === id ? { ...r, active: !r.active } : r
    )
    persistRoutines(updated)
  }

  // 루틴 삭제
  const handleDelete = (id: string) => {
    if (!confirm('이 루틴을 삭제하시겠습니까?')) return

    const updated = routines.filter((r) => r.id !== id)
    persistRoutines(updated)
  }

  // 요일 선택 토글
  const handleToggleDay = (day: number) => {
    setNewWeeklyDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day)
      } else {
        return [...prev, day].sort()
      }
    })
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{t.common.loading}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>{t.pages.routinesTitle}</h1>

      {/* 루틴 추가 폼 */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500' }}>{t.messages.addRoutine}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              {t.messages.routineTitle} *
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="루틴 제목"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              Cadence
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={newCadence === 'daily'}
                  onChange={() => {
                    setNewCadence('daily')
                    setNewWeeklyDays([])
                  }}
                />
                    <span>{t.messages.daily}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={newCadence === 'weekly'}
                      onChange={() => setNewCadence('weekly')}
                    />
                    <span>{t.messages.weekly}</span>
              </label>
            </div>
          </div>

          {newCadence === 'weekly' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                {t.messages.daysOfWeek}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {DAY_NAMES.map((dayName, index) => (
                  <label
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: newWeeklyDays.includes(index) ? '#e3f2fd' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newWeeklyDays.includes(index)}
                      onChange={() => handleToggleDay(index)}
                    />
                    <span style={{ fontSize: '0.875rem' }}>{dayName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newActive}
                onChange={(e) => setNewActive(e.target.checked)}
              />
              <span style={{ fontSize: '0.875rem' }}>{t.common.active}</span>
            </label>
          </div>

          <button
            onClick={handleAddRoutine}
            disabled={!newTitle.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: newTitle.trim() ? '#0070f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            {t.common.add}
          </button>
        </div>
      </div>

      {/* 루틴 목록 */}
      {routines.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            color: '#666',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem' }}>{t.messages.routinesEmpty}</p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>{t.messages.routinesEmptyHelper}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {routines.map((routine) => (
            <div
              key={routine.id}
              style={{
                padding: '1.5rem',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                backgroundColor: routine.active ? 'white' : '#f5f5f5',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>{routine.title}</h3>
                    {!routine.active && (
                      <span
                        style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                        }}
                      >
                        {t.common.inactive}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                    {t.messages.cadence}: {routine.cadence === 'daily' ? t.messages.daily : t.messages.weekly}
                  </div>
                  {routine.cadence === 'weekly' && routine.weeklyDays && routine.weeklyDays.length > 0 && (
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      Days: {routine.weeklyDays.map((d) => DAY_NAMES[d]).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={routine.active}
                      onChange={() => handleToggleActive(routine.id)}
                    />
                    <span style={{ fontSize: '0.875rem' }}>{t.common.active}</span>
                  </label>
                  <button
                    onClick={() => handleDelete(routine.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    {t.common.delete}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RoutinesPage() {
  return (
    <RequireAuth>
      <RoutinesPageContent />
    </RequireAuth>
  )
}
