'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { StepNav } from '@/components/StepNav'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase/client'
import { t } from '@/lib/uiText/ko'
import { getWeekKey, getDateKey } from '@/lib/keys'
import {
  loadWeeklyTasks as loadWeeklyTasksFromDB,
  updateWeeklyTask,
  AppWeeklyTask,
} from '@/lib/weeklyTasks'
import {
  getRoutines,
  setRoutines as saveRoutines,
  getRoutineCompletion,
  setRoutineCompletion,
} from '@/lib/mockStore'

// Use types from lib files
type WeeklyTask = AppWeeklyTask

// Project 타입 정의 (for display only, not used for DB operations)
interface Project {
  id: string
  title: string
  status: 'draft'
  created_at: string
}

// Routine 타입 정의
interface Routine {
  id: string
  title: string
  cadence: 'daily' | 'weekly'
  days?: number[] // 0-6 (Mon-Sun), only if cadence=weekly
  active: boolean
  created_at: string
}

// Routines 저장 형식
interface RoutinesData {
  routines: Routine[]
}

// 루틴 완료 상태 저장 형식
interface RoutineCompletion {
  [date: string]: {
    [routineId: string]: boolean
  }
}

// 제목 정규화 헬퍼 함수
function normalizeTitle(s: string): string {
  return (s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function TodayPageContent() {
  const router = useRouter()
  const { session } = useAuth()
  const [tasks, setTasks] = useState<WeeklyTask[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [allRoutines, setAllRoutines] = useState<Routine[]>([])
  const [routineCompletions, setRoutineCompletions] = useState<RoutineCompletion>({})
  const [loading, setLoading] = useState(true)
  const [todayDate, setTodayDate] = useState<string>('')
  const [weekKey, setWeekKey] = useState<string>('')
  const [todayDay, setTodayDay] = useState<number>(0) // 0-6 (Mon-Sun)
  const [promoteTaskId, setPromoteTaskId] = useState<string | null>(null)
  const [promoteForm, setPromoteForm] = useState({
    title: '',
    cadence: 'daily' as 'daily' | 'weekly',
    days: [] as number[],
  })

  // 오늘 날짜 및 주 키 계산
  useEffect(() => {
    const now = new Date()
    const currentTodayDate = getDateKey(now)
    const currentWeekKey = getWeekKey(now)
    const day = now.getDay() || 7 // 0 (일요일)을 7로 변환
    const todayDayIndex = day === 7 ? 0 : day - 1 // 0-6 (Mon-Sun)
    setTodayDate(currentTodayDate)
    setWeekKey(currentWeekKey)
    setTodayDay(todayDayIndex)
  }, [])

  // 프로젝트 로드 (for display only, not used for DB operations)
  useEffect(() => {
    // Projects are not needed for today page, but keep for compatibility
    setProjects([])
  }, [])

  // 루틴 로드 (모든 루틴)
  useEffect(() => {
    try {
      const parsed = getRoutines()
      const routinesList = parsed.routines || []
      setAllRoutines(routinesList)
      const activeRoutines = routinesList.filter((r) => r.active)
      setRoutines(activeRoutines)
    } catch (err) {
      console.error('Failed to load routines from localStorage:', err)
      setRoutines([])
      setAllRoutines([])
    }
  }, [])

  // 루틴 완료 상태 로드
  useEffect(() => {
    try {
      const parsed: RoutineCompletion = getRoutineCompletion()
      setRoutineCompletions(parsed)
    } catch (err) {
      console.error('Failed to load routine completions from localStorage:', err)
      setRoutineCompletions({})
    }
  }, [])

  // 주간 작업 로드 (picked_for_today = true인 것만)
  const loadWeeklyTasks = useCallback(async () => {
    if (!weekKey || !session?.user?.id) {
      setLoading(false)
      return
    }

    try {
      const result = await loadWeeklyTasksFromDB(session.user.id, weekKey, todayDate)
      // Filter tasks where picked_for_today = true (which maps to pickedDate === todayDate)
      const todayTasks = result.tasks.filter((task) => task.pickedDate === todayDate)
      setTasks(todayTasks)
    } catch (err) {
      console.error('Failed to load weekly tasks:', err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [weekKey, todayDate, session])

  useEffect(() => {
    loadWeeklyTasks()
  }, [loadWeeklyTasks])

  // Listen to data changes
  useEffect(() => {
    const onDataChanged = () => {
      loadWeeklyTasks()
    }
    window.addEventListener('app:data-changed' as any, onDataChanged)
    return () => {
      window.removeEventListener('app:data-changed' as any, onDataChanged)
    }
  }, [loadWeeklyTasks])

  // 작업 완료 토글
  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    try {
      await updateWeeklyTask(taskId, {
        status: task.status === 'todo' ? 'done' : 'todo',
      })
      await loadWeeklyTasks()
    } catch (err) {
      console.error('Failed to toggle task:', err)
      alert('작업 상태 변경에 실패했습니다: ' + (err as any)?.message)
    }
  }

  // 오늘에 적용되는 루틴 필터링
  const applicableRoutines = routines.filter((routine) => {
    if (!routine.active) return false
    if (routine.cadence === 'daily') return true
    if (routine.cadence === 'weekly' && routine.days) {
      return routine.days.includes(todayDay)
    }
    return false
  })

  // 루틴 제목 Set 생성
  const routineTitleSetToday = new Set(
    applicableRoutines.map((r) => normalizeTitle(r.title))
  )
  const routineTitleSetAll = new Set(
    allRoutines.map((r) => normalizeTitle(r.title))
  )

  // 루틴 완료 토글
  const handleToggleRoutine = (routineId: string) => {
    const currentCompletion = routineCompletions[todayDate]?.[routineId] || false
    const updated = {
      ...routineCompletions,
      [todayDate]: {
        ...routineCompletions[todayDate],
        [routineId]: !currentCompletion,
      },
    }
    try {
      setRoutineCompletion(updated)
      setRoutineCompletions(updated)
    } catch (err) {
      console.error('Failed to save routine completion:', err)
    }
  }

  // Task를 Routine으로 승격
  const handlePromoteToRoutine = (task: WeeklyTask) => {
    setPromoteTaskId(task.id)
    setPromoteForm({
      title: task.title.replace(/^\[Routine\] /, ''), // 기존 [Routine] 접두사 제거
      cadence: 'daily',
      days: [],
    })
  }

  // 루틴 승격 폼 저장
  const handleSavePromotedRoutine = () => {
    if (!promoteForm.title.trim()) return

    try {
      const routinesData = getRoutines()

      const newRoutine: Routine = {
        id: `routine-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: promoteForm.title.trim(),
        cadence: promoteForm.cadence,
        days: promoteForm.cadence === 'weekly' ? promoteForm.days : undefined,
        active: true,
        created_at: new Date().toISOString(),
      }

      routinesData.routines.push(newRoutine)
      saveRoutines(routinesData)
      setRoutines([...routines, newRoutine])
      setPromoteTaskId(null)
      setPromoteForm({ title: '', cadence: 'daily', days: [] })
    } catch (err) {
      console.error('Failed to save promoted routine:', err)
    }
  }

  // 오늘에서 제거 (picked_for_today = false)
  const handleRemoveFromToday = async (taskId: string) => {
    try {
      await updateWeeklyTask(taskId, {
        picked_for_today: false,
      })
      await loadWeeklyTasks()
    } catch (err) {
      console.error('Failed to remove task from today:', err)
      alert('오늘에서 제거에 실패했습니다: ' + (err as any)?.message)
    }
  }

  // 프로젝트별로 작업 그룹화 (오늘 표시되는 루틴과 중복 제거)
  const filteredTasks = tasks.filter(
    (task) => !routineTitleSetToday.has(normalizeTitle(task.title))
  )
  const filteredCount = tasks.length - filteredTasks.length

  const tasksByProject = filteredTasks.reduce((acc, task) => {
    const projectKey = task.projectId ?? 'null'
    if (!acc[projectKey]) {
      acc[projectKey] = []
    }
    acc[projectKey].push(task)
    return acc
  }, {} as Record<string, WeeklyTask[]>)

  // 프로젝트별로 정렬 (order 기준)
  Object.keys(tasksByProject).forEach((projectId) => {
    tasksByProject[projectId].sort((a, b) => a.order - b.order)
  })

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{t.common.loading}</p>
      </div>
    )
  }

  // 프로젝트 ID -> 프로젝트 제목 매핑
  const projectMap = projects.reduce((acc, project) => {
    acc[project.id] = project.title
    return acc
  }, {} as Record<string, string>)

  // 루틴 프로젝트 처리
  projectMap['__routines__'] = t.nav.routines

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{t.pages.todayTitle}</h1>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
          {todayDate || getDateKey(new Date())}
        </p>
      </div>

      {/* Routines 섹션 */}
      {applicableRoutines.length > 0 && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: '#f0f8ff',
          }}
        >
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500' }}>{t.nav.routines}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {applicableRoutines.map((routine) => {
              const isDone = routineCompletions[todayDate]?.[routine.id] || false
              return (
                <div
                  key={routine.id}
        style={{
          display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    backgroundColor: isDone ? '#f5f5f5' : 'white',
                  }}
                >
          <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => handleToggleRoutine(routine.id)}
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      textDecoration: isDone ? 'line-through' : 'none',
                      color: isDone ? '#999' : '#333',
                    }}
                  >
                    {routine.title}
                  </span>
                </div>
              )
            })}
        </div>
        </div>
      )}

      {/* Tasks 섹션 */}
      {tasks.length === 0 && applicableRoutines.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            color: '#666',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
            {t.messages.todayEmpty}
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
            {t.messages.todayEmptyHelper}
          </p>
          <a
            href="/weekly"
            style={{
              display: 'inline-block',
              marginTop: '1rem',
              color: '#0070f3',
              textDecoration: 'underline',
              fontSize: '0.875rem',
            }}
          >
            {t.nav.weekly} 페이지로 이동
          </a>
        </div>
      ) : filteredTasks.length > 0 ? (
        <div>
          {filteredCount > 0 && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px',
                fontSize: '0.875rem',
                color: '#856404',
              }}
            >
              {t.messages.routineDuplicateNote}
            </div>
          )}
          {Object.entries(tasksByProject).map(([projectId, projectTasks]) => {
            const projectTitle = projectId === 'null' 
              ? '프로젝트 없음' 
              : (projectMap[projectId] || '알 수 없는 프로젝트')
            return (
              <div
                key={projectId}
                style={{
                  marginBottom: '2rem',
                  padding: '1.5rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                }}
              >
                <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500' }}>
                  {projectTitle}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {projectTasks.map((task) => (
                    <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        backgroundColor: task.status === 'done' ? '#f5f5f5' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                        checked={task.status === 'done'}
                        onChange={() => handleToggleTask(task.id)}
                        style={{
                          width: '1.25rem',
                          height: '1.25rem',
                          cursor: 'pointer',
                        }}
              />
              <span
                style={{
                          flex: 1,
                          textDecoration: task.status === 'done' ? 'line-through' : 'none',
                          color: task.status === 'done' ? '#999' : '#333',
                }}
              >
                {task.title}
              </span>
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        {routineTitleSetAll.has(normalizeTitle(task.title)) ? (
                          <span
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                            }}
                          >
                            {t.messages.alreadyARoutine}
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePromoteToRoutine(task)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            {t.messages.saveAsRoutine}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveFromToday(task.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          {t.common.remove}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Task를 Routine으로 승격하는 모달 */}
      {promoteTaskId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setPromoteTaskId(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>{t.messages.saveAsRoutine}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  {t.messages.routineTitle} *
                </label>
                <input
                  type="text"
                  value={promoteForm.title}
                  onChange={(e) => setPromoteForm({ ...promoteForm, title: e.target.value })}
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
                  {t.messages.cadence}
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={promoteForm.cadence === 'daily'}
                      onChange={() => setPromoteForm({ ...promoteForm, cadence: 'daily', days: [] })}
                    />
                    <span>{t.messages.daily}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={promoteForm.cadence === 'weekly'}
                      onChange={() => setPromoteForm({ ...promoteForm, cadence: 'weekly' })}
                    />
                    <span>{t.messages.weekly}</span>
                  </label>
                </div>
              </div>
              {promoteForm.cadence === 'weekly' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    {t.messages.daysOfWeek}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, index) => (
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
                          backgroundColor: promoteForm.days.includes(index) ? '#e3f2fd' : 'white',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={promoteForm.days.includes(index)}
                          onChange={() => {
                            const newDays = promoteForm.days.includes(index)
                              ? promoteForm.days.filter((d) => d !== index)
                              : [...promoteForm.days, index].sort()
                            setPromoteForm({ ...promoteForm, days: newDays })
                          }}
                        />
                        <span style={{ fontSize: '0.875rem' }}>{dayName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPromoteTaskId(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleSavePromotedRoutine}
                  disabled={!promoteForm.title.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: promoteForm.title.trim() ? '#0070f3' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: promoteForm.title.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem',
                  }}
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step Navigation */}
      <StepNav
        prev={{
          href: '/weekly',
          label: '← 이전 단계(위클리)',
        }}
        next={{
          href: '/review',
          label: '다음 단계(리뷰) →',
        }}
      />
    </div>
  )
}

export default function TodayPage() {
  return (
    <RequireAuth>
      <TodayPageContent />
    </RequireAuth>
  )
}

