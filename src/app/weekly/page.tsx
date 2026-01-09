'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { StepNav } from '@/components/StepNav'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase/client'
import { t } from '@/lib/uiText/ko'
import { getDateKey, getWeekKey, getMonthKey } from '@/lib/keys'
import { loadProjects, AppProject } from '@/lib/projects'
import { loadMonthlyFocus } from '@/lib/monthlyFocus'
import {
  loadWeeklyTasks as loadWeeklyTasksFromDB,
  createWeeklyTask,
  updateWeeklyTask,
  deleteWeeklyTask,
  bulkReorderWeeklyTasks,
  AppWeeklyTask,
} from '@/lib/weeklyTasks'
import { getRoutines, setRoutines } from '@/lib/mockStore'

// Use types from lib files
type Project = AppProject
type WeeklyTask = AppWeeklyTask

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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// 제목 정규화 헬퍼 함수
function normalizeTitle(s: string): string {
  return (s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// 테이블 누락 에러 감지
const isTableMissingError = (error: any): boolean => {
  if (!error) return false
  const message = error.message || error.toString() || ''
  return (
    message.includes('schema cache') ||
    message.includes('Could not find the table') ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    error.code === 'PGRST301' ||
    error.code === '42P01'
  )
}

function WeeklyPageContent() {
  const router = useRouter()
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [focusedProjectIds, setFocusedProjectIds] = useState<string[]>([])
  const [weekKey, setWeekKey] = useState<string>('')
  const [tasks, setTasks] = useState<WeeklyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({})
  const [actionSelections, setActionSelections] = useState<Record<string, Set<string>>>({})
  const [actionCollapse, setActionCollapse] = useState<Record<string, boolean>>({})
  const [actionMessages, setActionMessages] = useState<Record<string, string | null>>({})
  // 최신 Mandarat 데이터 매핑
  const [actionTextMap, setActionTextMap] = useState<Record<string, string>>({})
  const [strategyTextMap, setStrategyTextMap] = useState<Record<number, string>>({})
  // Task를 Routine으로 승격
  const [promoteTaskId, setPromoteTaskId] = useState<string | null>(null)
  const [promoteForm, setPromoteForm] = useState({
    title: '',
    cadence: 'daily' as 'daily' | 'weekly',
    days: [] as number[],
  })
  // 모든 루틴 로드 (중복 체크용)
  const [allRoutines, setAllRoutines] = useState<Routine[]>([])
  const [supabaseError, setSupabaseError] = useState<string | null>(null)
  const todayDate = getDateKey(new Date())

  // 현재 주 키 계산
  useEffect(() => {
    const currentWeekKey = getWeekKey(new Date())
    setWeekKey(currentWeekKey)
  }, [])


  // 모든 루틴 로드 (중복 체크용)
  useEffect(() => {
    try {
      const parsed = getRoutines()
      setAllRoutines(parsed.routines || [])
    } catch (err) {
      console.error('Failed to load routines from localStorage:', err)
      setAllRoutines([])
    }
  }, [])


  // 최신 Mandarat 데이터 로드 (read-only)
  useEffect(() => {
    if (!session?.user?.id) return

    const loadMandaratData = async () => {
      try {
        const userId = session.user.id

        // 1. Board 로드
        const { data: boardData, error: boardError } = await supabase
          .from('mandarat_boards')
          .select('*')
          .eq('user_id', userId)
          .limit(1)
          .single()

        if (isTableMissingError(boardError)) {
          // 테이블이 없으면 fallback (스냅샷 사용)
          return
        }

        if (boardError && boardError.code !== 'PGRST116') {
          // 에러가 있지만 테이블 누락이 아니면 fallback
          return
        }

        if (!boardData) return

        // 2. Strategies 로드
        const { data: strategiesData, error: strategiesError } = await supabase
          .from('mandarat_strategies')
          .select('*')
          .eq('board_id', boardData.id)
          .order('strategy_index', { ascending: true })

        if (isTableMissingError(strategiesError)) {
          return
        }

        if (strategiesError) {
          return
        }

        const strategyMap: Record<number, string> = {}
        if (strategiesData) {
          strategiesData.forEach((s) => {
            if (s.strategy_index >= 0 && s.strategy_index < 8) {
              strategyMap[s.strategy_index] = s.text_value || ''
            }
          })
        }
        setStrategyTextMap(strategyMap)

        // 3. Actions 로드
        const { data: actionsData, error: actionsError } = await supabase
          .from('mandarat_actions')
          .select('*')
          .eq('board_id', boardData.id)
          .order('strategy_index', { ascending: true })
          .order('action_index', { ascending: true })

        if (isTableMissingError(actionsError)) {
          return
        }

        if (actionsError) {
          return
        }

        const actionMap: Record<string, string> = {}
        if (actionsData) {
          actionsData.forEach((a) => {
            if (
              a.strategy_index >= 0 &&
              a.strategy_index < 8 &&
              a.action_index >= 0 &&
              a.action_index < 8
            ) {
              const key = `${a.strategy_index}:${a.action_index}`
              actionMap[key] = a.text_value || ''
            }
          })
        }
        setActionTextMap(actionMap)
      } catch (err) {
        console.error('Failed to load Mandarat data:', err)
        // 에러 발생 시 fallback (스냅샷 사용)
      }
    }

    loadMandaratData()
  }, [session?.user?.id])

  // 주간 작업 로드
  const loadWeeklyTasks = useCallback(async () => {
    if (!weekKey || !session?.user?.id) {
      setLoading(false)
      return
    }

    try {
      setSupabaseError(null)
      const result = await loadWeeklyTasksFromDB(session.user.id, weekKey, todayDate)
      setTasks(result.tasks)
      if (result.error) {
        setSupabaseError(result.error)
      }
    } catch (err) {
      console.error('Failed to load weekly tasks:', err)
      setTasks([])
      setSupabaseError('주간 작업을 불러오는 데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [weekKey, session, todayDate])

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

  // 주간 작업 저장 (bulk reorder용)
  const saveWeeklyTasks = useCallback(
    async (updatedTasks: WeeklyTask[]) => {
      if (!weekKey || !session?.user?.id) return

      try {
        // Normalize order_index
        const updates = updatedTasks.map((task, index) => ({
          id: task.id,
          order_index: index,
        }))

        await bulkReorderWeeklyTasks(updates)
        // Reload to get fresh data
        await loadWeeklyTasks()
      } catch (err) {
        console.error('Failed to save weekly tasks:', err)
        alert('작업 순서 저장에 실패했습니다: ' + (err as any)?.message)
      }
    },
    [weekKey, session, loadWeeklyTasks]
  )

  // 여러 개의 타이틀을 받아 작업을 추가 (중복은 건너뜀)
  const addTasks = useCallback(
    async (projectId: string, titles: string[]) => {
      if (!session?.user?.id || !weekKey) return { added: 0, skipped: 0 }

      const trimmed = titles.map((t) => t.trim()).filter(Boolean)
      if (trimmed.length === 0) return { added: 0, skipped: 0 }

      const existingTitles = new Set(
        tasks.filter((t) => t.projectId === projectId).map((t) => t.title.trim().toLowerCase())
      )

      let skipped = 0
      let added = 0

      for (const title of trimmed) {
        const lower = title.toLowerCase()
        if (existingTitles.has(lower)) {
          skipped += 1
          continue
        }
        existingTitles.add(lower)

        try {
          await createWeeklyTask(weekKey, projectId, title, session.user.id)
          added += 1
        } catch (err) {
          console.error('Failed to create task:', err)
        }
      }

      // Reload tasks
      await loadWeeklyTasks()

      return { added, skipped }
    },
    [tasks, weekKey, session, loadWeeklyTasks]
  )

  // 작업 추가
  const handleAddTask = async (projectId: string) => {
    const title = newTaskInputs[projectId]?.trim()
    if (!title) return

    await addTasks(projectId, [title])
    setNewTaskInputs((prev) => ({ ...prev, [projectId]: '' }))
  }

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

  // 오늘 선택 토글
  const handleTogglePickedDate = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    try {
      const isPicked = task.pickedDate === todayDate
      await updateWeeklyTask(taskId, {
        picked_for_today: !isPicked,
      })
      await loadWeeklyTasks()
    } catch (err) {
      console.error('Failed to toggle picked date:', err)
      alert('오늘 선택 상태 변경에 실패했습니다: ' + (err as any)?.message)
    }
  }

  // 작업 삭제
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteWeeklyTask(taskId)
      await loadWeeklyTasks()
    } catch (err) {
      console.error('Failed to delete task:', err)
      alert('작업 삭제에 실패했습니다: ' + (err as any)?.message)
    }
  }

  // Task를 Routine으로 승격
  const handlePromoteToRoutine = (task: WeeklyTask) => {
    setPromoteTaskId(task.id)
    setPromoteForm({
      title: task.title.replace(/^\[Routine\] /, ''),
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
      setRoutines(routinesData)
      setPromoteTaskId(null)
      setPromoteForm({ title: '', cadence: 'daily', days: [] })
    } catch (err) {
      console.error('Failed to save promoted routine:', err)
    }
  }

  // 작업 순서 변경 (위로)
  const handleMoveUp = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // 같은 프로젝트의 작업들만 필터링하고 정렬
    const projectTasks = tasks
      .filter((t) => t.projectId === task.projectId)
      .sort((a, b) => a.order - b.order)

    const projectTaskIndex = projectTasks.findIndex((t) => t.id === taskId)
    if (projectTaskIndex <= 0) return

    // 프로젝트 내에서 순서 변경
    const updatedProjectTasks = [...projectTasks]
    ;[updatedProjectTasks[projectTaskIndex - 1], updatedProjectTasks[projectTaskIndex]] = [
      projectTasks[projectTaskIndex],
      projectTasks[projectTaskIndex - 1],
    ]

    // 전체 tasks 배열 업데이트
    const updatedTasks = tasks.map((t) => {
      if (t.projectId === task.projectId) {
        const newIndex = updatedProjectTasks.findIndex((pt) => pt.id === t.id)
        if (newIndex >= 0) {
          return updatedProjectTasks[newIndex]
        }
      }
      return t
    })

    await saveWeeklyTasks(updatedTasks)
  }

  // 작업 순서 변경 (아래로)
  const handleMoveDown = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // 같은 프로젝트의 작업들만 필터링하고 정렬
    const projectTasks = tasks
      .filter((t) => t.projectId === task.projectId)
      .sort((a, b) => a.order - b.order)

    const projectTaskIndex = projectTasks.findIndex((t) => t.id === taskId)
    if (projectTaskIndex < 0 || projectTaskIndex >= projectTasks.length - 1) return

    // 프로젝트 내에서 순서 변경
    const updatedProjectTasks = [...projectTasks]
    ;[updatedProjectTasks[projectTaskIndex], updatedProjectTasks[projectTaskIndex + 1]] = [
      projectTasks[projectTaskIndex + 1],
      projectTasks[projectTaskIndex],
    ]

    // 전체 tasks 배열 업데이트
    const updatedTasks = tasks.map((t) => {
      if (t.projectId === task.projectId) {
        const newIndex = updatedProjectTasks.findIndex((pt) => pt.id === t.id)
        if (newIndex >= 0) {
          return updatedProjectTasks[newIndex]
        }
      }
      return t
    })

    await saveWeeklyTasks(updatedTasks)
  }

  // 액션 아이템 선택 토글
  const toggleActionSelection = (projectId: string, key: string) => {
    setActionSelections((prev) => {
      const next = { ...prev }
      const currentSet = new Set(next[projectId] ?? [])
      if (currentSet.has(key)) {
        currentSet.delete(key)
      } else {
        currentSet.add(key)
      }
      next[projectId] = currentSet
      return next
    })
  }

  // 액션 아이템 전체 선택
  const selectAllActions = (projectId: string, keys: string[]) => {
    setActionSelections((prev) => ({
      ...prev,
      [projectId]: new Set(keys),
    }))
  }

  // 액션 아이템 선택 해제
  const clearActions = (projectId: string) => {
    setActionSelections((prev) => ({
      ...prev,
      [projectId]: new Set(),
    }))
  }

  // 선택된 액션을 주간 작업으로 추가
  const handleAddSelectedActions = async (projectId: string, titles: string[]) => {
    const result = await addTasks(projectId, titles)
    // 선택 초기화
    clearActions(projectId)

    if (!result) return

    const messages = []
    if (result.added > 0) {
      messages.push(`${result.added}개 추가`)
    }
    if (result.skipped > 0) {
      messages.push(`${result.skipped}개 중복 건너뜀`)
    }

    if (messages.length > 0) {
      const msg = messages.join(', ')
      setActionMessages((prev) => ({ ...prev, [projectId]: msg }))
      setTimeout(() => {
        setActionMessages((prev) => ({ ...prev, [projectId]: null }))
      }, 3000)
    }
  }


  // 포커스된 프로젝트 필터링
  const focusedProjects = projects.filter((p) => focusedProjectIds.includes(p.id))

  // 프로젝트별 작업 그룹화 및 정렬
  const tasksByProject = focusedProjects.reduce((acc, project) => {
    const projectTasks = tasks
      .filter((t) => t.projectId === project.id)
      .sort((a, b) => a.order - b.order)
    acc[project.id] = projectTasks
    return acc
  }, {} as Record<string, WeeklyTask[]>)

  // projectId가 null인 작업 그룹 추가
  const nullProjectTasks = tasks
    .filter((t) => t.projectId === null)
    .sort((a, b) => a.order - b.order)
  if (nullProjectTasks.length > 0) {
    tasksByProject['null'] = nullProjectTasks
  }


  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{t.common.loading}</p>
      </div>
    )
  }

  // 포커스된 프로젝트가 없을 때
  const showEmptyState = focusedProjects.length === 0

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>{t.pages.weeklyTitle}</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.875rem' }}>
        {weekKey || getWeekKey(new Date())}
      </p>

      {supabaseError && (
        <div
          style={{
            color: '#856404',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          {supabaseError}
        </div>
      )}



      {focusedProjects.map((project) => {
        const projectTasks = tasksByProject[project.id] || []
        const inputValue = newTaskInputs[project.id] || ''
        const actionItems = project.source?.items || []
        const actionSelectionSet = actionSelections[project.id] ?? new Set<string>()
        const isActionOpen = actionCollapse[project.id] ?? true
        const actionMessage = actionMessages[project.id]

        // Mandarat 항목과 수동 항목을 그룹화
        const mandaratItems = actionItems.filter((item) => {
          // Check if item has source property (for manual items) or strategy_index (for mandarat items)
          return (item as any).source === 'mandarat' && item.strategy_index !== undefined
        })
        const manualItems = actionItems.filter((item) => (item as any).source === 'manual')

        const groupedActions = mandaratItems.reduce((acc, item) => {
          // 최신 strategy 텍스트 사용 (없으면 스냅샷 사용)
          const displayStrategyText = (strategyTextMap[item.strategy_index!] ?? item.strategy_text) || `Strategy ${item.strategy_index! + 1}`
          if (!acc[displayStrategyText]) acc[displayStrategyText] = []
          acc[displayStrategyText].push(item)
          return acc
        }, {} as Record<string, typeof mandaratItems>)

        // Mandarat 액션 키 생성 (선택용)
        const mandaratActionKeys = mandaratItems.map(
          (item) => `${item.strategy_index}:${item.action_index}`
        )

        return (
          <div
            key={project.id}
            style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              backgroundColor: 'white',
            }}
          >
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500' }}>
              {project.title}
            </h2>

            {/* Mandarat 액션 목록 (접기/펼치기) */}
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={() =>
                  setActionCollapse((prev) => ({ ...prev, [project.id]: !isActionOpen }))
                }
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Project Actions (from Mandarat) {isActionOpen ? '▲' : '▼'}
              </button>

              {isActionOpen && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  {actionItems.length === 0 ? (
                    <p style={{ margin: 0, color: '#777', fontSize: '0.875rem' }}>
                      {t.messages.noActionItems}
                    </p>
                  ) : (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <button
                          onClick={() => selectAllActions(project.id, mandaratActionKeys)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            backgroundColor: '#e9ecef',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                          disabled={mandaratActionKeys.length === 0}
                        >
                          {t.messages.selectAll}
                        </button>
                        <button
                          onClick={() => clearActions(project.id)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            backgroundColor: '#e9ecef',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          {t.messages.clear}
                        </button>
                        <button
                          onClick={() => {
                            const titles = mandaratItems
                              .filter((item) =>
                                actionSelectionSet.has(
                                  `${item.strategy_index}:${item.action_index}`
                                )
                              )
                              .map((item) => {
                                // 최신 action 텍스트 사용 (없으면 스냅샷 사용)
                                const key = `${item.strategy_index}:${item.action_index}`
                                return actionTextMap[key] ?? item.action_text ?? (item as any).title ?? ''
                              })
                            handleAddSelectedActions(project.id, titles)
                          }}
                          disabled={actionSelectionSet.size === 0}
                          style={{
                            padding: '0.35rem 0.75rem',
                            backgroundColor: actionSelectionSet.size > 0 ? '#0070f3' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: actionSelectionSet.size > 0 ? 'pointer' : 'not-allowed',
                            fontSize: '0.8rem',
                          }}
                        >
                          {t.messages.addSelectedAsTasks} ({actionSelectionSet.size})
                        </button>
                      </div>

                      {actionMessage && (
                        <div
                          style={{
                            marginBottom: '0.5rem',
                            color: '#155724',
                            backgroundColor: '#d4edda',
                            borderRadius: '4px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          {actionMessage}
                        </div>
                      )}

                      {Object.entries(groupedActions).map(([strategy, items]) => (
                        <div key={strategy} style={{ marginBottom: '0.75rem' }}>
                          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                            {strategy}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {items.map((item) => {
                              const key = `${item.strategy_index}:${item.action_index}`
                              const checked = actionSelectionSet.has(key)
                              // 최신 action 텍스트 사용 (없으면 스냅샷 사용)
                              const displayActionText = actionTextMap[key] ?? item.action_text
                              return (
                                <label
                                  key={key}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.35rem 0.5rem',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '4px',
                                    backgroundColor: checked ? '#eef4ff' : 'white',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleActionSelection(project.id, key)}
                                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: '0.9rem' }}>{displayActionText}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 작업 목록 */}
            {projectTasks.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {projectTasks.map((task, index) => {
                  const canMoveUp = index > 0
                  const canMoveDown = index < projectTasks.length - 1

                  return (
                  <div
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        backgroundColor: task.status === 'done' ? '#f5f5f5' : 'transparent',
                        borderRadius: '4px',
                      border: '1px solid #e0e0e0',
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
                        {task.pickedDate === todayDate && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              padding: '0.125rem 0.375rem',
                              backgroundColor: '#28a745',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                            }}
                          >
                            {t.messages.pickedForToday}
                          </span>
                        )}
                      </span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={() => handleTogglePickedDate(task.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: task.pickedDate === todayDate ? '#28a745' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          {task.pickedDate === todayDate ? t.messages.unpickFromToday : t.messages.pickedForToday}
                        </button>
                        <button
                          onClick={() => handleMoveUp(task.id)}
                          disabled={!canMoveUp}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: canMoveUp ? '#0070f3' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: canMoveUp ? 'pointer' : 'not-allowed',
                            fontSize: '0.75rem',
                        }}
                      >
                        ↑
                      </button>
                      <button
                          onClick={() => handleMoveDown(task.id)}
                          disabled={!canMoveDown}
                        style={{
                          padding: '0.25rem 0.5rem',
                            backgroundColor: canMoveDown ? '#0070f3' : '#ccc',
                            color: 'white',
                            border: 'none',
                          borderRadius: '4px',
                            cursor: canMoveDown ? 'pointer' : 'not-allowed',
                            fontSize: '0.75rem',
                        }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
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
                        삭제
                      </button>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}

            {/* 새 작업 추가 */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) =>
                  setNewTaskInputs((prev) => ({ ...prev, [project.id]: e.target.value }))
                }
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTask(project.id)
                  }
                }}
                placeholder="새 작업 추가..."
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
              <button
                onClick={() => handleAddTask(project.id)}
                disabled={!inputValue.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: inputValue.trim() ? '#0070f3' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                }}
              >
                {t.common.add}
              </button>
            </div>
          </div>
        )
      })}

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
                  Cadence
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={promoteForm.cadence === 'daily'}
                      onChange={() => setPromoteForm({ ...promoteForm, cadence: 'daily', days: [] })}
                    />
                    <span>Daily</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={promoteForm.cadence === 'weekly'}
                      onChange={() => setPromoteForm({ ...promoteForm, cadence: 'weekly' })}
                    />
                    <span>Weekly</span>
                  </label>
                </div>
              </div>
              {promoteForm.cadence === 'weekly' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Days of week
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
          href: '/focus',
          label: '← 이전 단계(먼슬리)',
        }}
        next={{
          href: '/today',
          label: '다음 단계(투데이) →',
          disabled: tasks.length === 0,
          hint: '이번 주 할 일을 Task로 추가해 주세요.',
        }}
      />
    </div>
  )
}

export default function WeeklyPage() {
  return (
    <RequireAuth>
      <WeeklyPageContent />
    </RequireAuth>
  )
}
