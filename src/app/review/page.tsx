'use client'

import { useState, useEffect, useCallback } from 'react'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { t } from '@/lib/uiText/ko'
import { getWeekKey } from '@/lib/keys'
import { getProjects, getWeeklyPlan, setWeeklyPlan } from '@/lib/mockStore'

// Weekly Task 타입 정의
interface WeeklyTask {
  id: string
  projectId: string | null // null 허용 (삭제된 프로젝트)
  title: string
  status: 'todo' | 'done'
  order: number
  created_at: string
  pickedDate?: string
}

// Weekly Plan 타입 정의
interface WeeklyPlan {
  weeks: Record<string, { tasks: WeeklyTask[] }>
}

// Project 타입 정의
interface Project {
  id: string
  title: string
  status: 'draft'
  created_at: string
  source?: {
    yearlyGoal: string
    items: Array<{
      strategy_index: number
      action_index: number
      strategy_text: string
      action_text: string
    }>
  }
  source_strategy_index?: number
  source_action_index?: number
}

function getCurrentWeekKey(): string {
  return getWeekKey(new Date())
}

function getNextWeekKey(): string {
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  return getWeekKey(nextWeek)
}

function ReviewPageContent() {
  const [tasks, setTasks] = useState<WeeklyTask[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [weekKey, setWeekKey] = useState<string>('')
  const [nextWeekKey, setNextWeekKey] = useState<string>('')
  const [carryOverSelections, setCarryOverSelections] = useState<Set<string>>(new Set())
  const [carryOverMessage, setCarryOverMessage] = useState<string | null>(null)
  const [carriedTaskIds, setCarriedTaskIds] = useState<Set<string>>(new Set())

  // 주 키 계산
  useEffect(() => {
    const currentWeekKey = getCurrentWeekKey()
    const nextWeek = getNextWeekKey()
    setWeekKey(currentWeekKey)
    setNextWeekKey(nextWeek)
  }, [])

  // 리뷰 데이터 로드 (프로젝트 + 주간 작업)
  const loadReviewData = useCallback(() => {
    // 프로젝트 로드
    try {
      const parsed = getProjects<Project[]>()
      setProjects(Array.isArray(parsed) ? parsed : [])
    } catch (err) {
      console.error('Failed to load projects from localStorage:', err)
      setProjects([])
    }

    // 주간 작업 로드
    if (!weekKey) return

    try {
      const parsed: WeeklyPlan = getWeeklyPlan()
      const weekData = parsed.weeks?.[weekKey]
      if (weekData && Array.isArray(weekData.tasks)) {
        setTasks(weekData.tasks)
      } else {
        setTasks([])
      }
    } catch (err) {
      console.error('Failed to load weekly tasks from localStorage:', err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [weekKey])

  // 초기 로드 및 이벤트 리스너 설정
  useEffect(() => {
    loadReviewData()

    // Storage 이벤트 리스너 (다른 탭에서 localStorage 변경 감지)
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (e.key.startsWith('mock_')) {
        loadReviewData()
      }
    }

    // 커스텀 이벤트 리스너 (같은 탭 내에서 데이터 변경 감지)
    const onCustom = () => {
      loadReviewData()
    }

    // 포커스 이벤트 리스너 (탭으로 돌아올 때)
    const onFocus = () => {
      loadReviewData()
    }

    // 가시성 변경 이벤트 리스너 (탭이 보일 때)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadReviewData()
      }
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('app:data-changed' as any, onCustom)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('app:data-changed' as any, onCustom)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loadReviewData])

  // 프로젝트 ID -> 프로젝트 제목 매핑
  const projectMap = projects.reduce((acc, project) => {
    acc[project.id] = project.title
    return acc
  }, {} as Record<string, string>)

  // 미완료 작업만 필터링 (이월용, 존재하는 프로젝트의 작업만)
  const unfinishedTasks = tasks.filter((task) => task.status === 'todo' && projectMap[task.projectId])

  // 초기 선택: 모든 미완료 작업 선택
  useEffect(() => {
    if (unfinishedTasks.length > 0 && carryOverSelections.size === 0) {
      setCarryOverSelections(new Set(unfinishedTasks.map((t) => t.id)))
    }
  }, [unfinishedTasks.length])

  // 프로젝트별 통계 계산 (projectId가 null이 아닌 작업만)
  const projectStats = tasks.reduce((acc, task) => {
    // projectId가 null이거나 존재하지 않는 프로젝트의 작업은 제외
    if (!task.projectId || !projectMap[task.projectId]) return acc
    
    if (!acc[task.projectId]) {
      acc[task.projectId] = { total: 0, done: 0 }
    }
    acc[task.projectId].total += 1
    if (task.status === 'done') {
      acc[task.projectId].done += 1
    }
    return acc
  }, {} as Record<string, { total: number; done: number }>)

  // 전체 통계 (projectId가 null이 아니고 존재하는 프로젝트의 작업만 포함)
  const validTasks = tasks.filter((t) => t.projectId !== null && projectMap[t.projectId])
  const totalTasks = validTasks.length
  const doneTasks = validTasks.filter((t) => t.status === 'done').length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  // 이월 선택 토글
  const handleToggleCarryOver = (taskId: string) => {
    setCarryOverSelections((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  // 다음 주로 이월
  const handleCarryOver = () => {
    if (!weekKey || !nextWeekKey || carryOverSelections.size === 0) return

    try {
      const weeklyPlan: WeeklyPlan = getWeeklyPlan()
      if (!weeklyPlan.weeks) {
        weeklyPlan.weeks = {}
      }

      // 다음 주의 기존 작업 로드
      const nextWeekTasks = weeklyPlan.weeks[nextWeekKey]?.tasks || []
      
      // 중복 체크용: projectId + title 조합
      const existingTaskKeys = new Set(
        nextWeekTasks.map((t) => `${t.projectId}:${t.title.toLowerCase().trim()}`)
      )

      let carried = 0
      let duplicates = 0
      const newTasks: WeeklyTask[] = []

      // 선택된 작업들을 다음 주로 복사
      carryOverSelections.forEach((taskId) => {
        const task = tasks.find((t) => t.id === taskId)
        if (!task) return

        const taskKey = `${task.projectId}:${task.title.toLowerCase().trim()}`
        
        // 중복 체크
        if (existingTaskKeys.has(taskKey)) {
          duplicates += 1
          return
        }

        // 새 작업 생성
        const newTask: WeeklyTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          projectId: task.projectId,
          title: task.title,
          status: 'todo',
          order: nextWeekTasks.length + newTasks.length,
          created_at: new Date().toISOString(),
          // pickedDate는 undefined로 설정
        }

        newTasks.push(newTask)
        existingTaskKeys.add(taskKey)
        carried += 1
      })

      // 다음 주 작업에 추가
      const updatedNextWeekTasks = [...nextWeekTasks, ...newTasks]
      
      // order 정규화
      const normalizedTasks = updatedNextWeekTasks.map((task, index) => ({
        ...task,
        order: index,
      }))

    weeklyPlan.weeks[nextWeekKey] = { tasks: normalizedTasks }
    setWeeklyPlan(weeklyPlan)

      // 데이터 리로드
      loadReviewData()

      // 성공 메시지
      const messages = []
      if (carried > 0) {
        messages.push(`${carried}개 이월됨`)
      }
      if (duplicates > 0) {
        messages.push(`${duplicates}개 중복 건너뜀`)
      }
      setCarryOverMessage(messages.join(', '))
      setTimeout(() => setCarryOverMessage(null), 5000)

      // 이월된 작업 ID 저장 (UI에서 비활성화)
      setCarriedTaskIds(new Set(carryOverSelections))

      // 선택 초기화
      setCarryOverSelections(new Set())
    } catch (err) {
      console.error('Failed to carry over tasks:', err)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{t.common.loading}</p>
      </div>
    )
  }

  if (validTasks.length === 0) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>{t.pages.reviewTitle}</h1>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.875rem' }}>
          {weekKey || getCurrentWeekKey()}
        </p>
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
            {t.messages.reviewEmpty}
          </p>
          <a
            href="/weekly"
            style={{
              color: '#0070f3',
              textDecoration: 'underline',
              fontSize: '0.875rem',
            }}
          >
            {t.messages.reviewEmptyLink}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Weekly Review</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.875rem' }}>
        {weekKey || getCurrentWeekKey()}
      </p>

      {/* 전체 통계 */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500' }}>{t.messages.overall}</h2>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>{t.messages.totalTasks}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '500' }}>{totalTasks}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>{t.messages.done}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '500', color: '#28a745' }}>{doneTasks}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>{t.messages.completionRate}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '500' }}>{completionRate}%</div>
          </div>
        </div>
      </div>

      {/* 프로젝트별 통계 */}
      {Object.keys(projectStats).length > 0 && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: 'white',
          }}
        >
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500' }}>{t.messages.byProject}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(projectStats).map(([projectId, stats]) => {
              const projectTitle = projectMap[projectId] || '알 수 없는 프로젝트'
              const projectCompletionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
              return (
                <div
                  key={projectId}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    backgroundColor: '#f9f9f9',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontWeight: '500' }}>{projectTitle}</div>
                    <div style={{ fontSize: '0.875rem', color: '#666' }}>
                      {stats.done} / {stats.total} ({projectCompletionRate}%)
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 다음 주로 이월 */}
      {unfinishedTasks.length > 0 && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: 'white',
          }}
        >
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '500' }}>
            {t.messages.carryOverToNextWeek}
          </h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#666' }}>
            {nextWeekKey || getNextWeekKey()}
          </p>

          {carryOverMessage && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                backgroundColor: '#d4edda',
                color: '#155724',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              {carryOverMessage}
            </div>
          )}

          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {unfinishedTasks.map((task) => {
              const isSelected = carryOverSelections.has(task.id)
              const isCarried = carriedTaskIds.has(task.id)
              const projectTitle = task.projectId === null 
                ? '프로젝트 없음' 
                : (projectMap[task.projectId] || '알 수 없는 프로젝트')

              return (
                <label
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    backgroundColor: isCarried ? '#f5f5f5' : isSelected ? '#eef4ff' : 'white',
                    opacity: isCarried ? 0.6 : 1,
                    cursor: isCarried ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleCarryOver(task.id)}
                    disabled={isCarried}
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      cursor: isCarried ? 'not-allowed' : 'pointer',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500' }}>{task.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>{projectTitle}</div>
                  </div>
                  {isCarried && (
                    <span
                      style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: '#28a745',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                      }}
                    >
                      {t.messages.carried}
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          <button
            onClick={handleCarryOver}
            disabled={carryOverSelections.size === 0}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: carryOverSelections.size > 0 ? '#0070f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: carryOverSelections.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
              fontWeight: '500',
            }}
          >
            {t.messages.carryOverSelected} {nextWeekKey || getNextWeekKey()}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewPageContent />
    </RequireAuth>
  )
}
