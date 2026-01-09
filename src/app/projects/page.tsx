'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { StepNav } from '@/components/StepNav'
import { useAuth } from '@/components/auth/AuthProvider'
import { t } from '@/lib/uiText/ko'
import { getMonthKey } from '@/lib/keys'
import { getMonthlyFocus, setMonthlyFocus, getWeeklyPlan, setWeeklyPlan } from '@/lib/mockStore'
import { loadProjects, deleteProject, AppProject } from '@/lib/projects'

// Use AppProject type from projects.ts
type Project = AppProject

// Monthly Focus 타입 정의
interface MonthlyFocus {
  monthKey: string // "YYYY-MM"
  projectIds: string[]
}

function ProjectsPageContent() {
  const router = useRouter()
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [focusedProjectIds, setFocusedProjectIds] = useState<string[]>([])
  const [monthKey, setMonthKey] = useState<string>('')
  const [monthResetNotice, setMonthResetNotice] = useState(false)
  const [maxReachedWarning, setMaxReachedWarning] = useState(false)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)

  // Load projects from Supabase (with localStorage fallback)
  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        setSupabaseError(null)
        const result = await loadProjects(session.user.id)
        setProjects(result.projects)
        setMonthKey(getMonthKey(new Date()))
        
        if (!result.fromSupabase && result.error) {
          setSupabaseError('Supabase 연결 실패. 로컬 데이터를 사용 중입니다.')
        }
      } catch (err) {
        console.error('Failed to load projects:', err)
        setSupabaseError('프로젝트 로드 실패. 로컬 데이터를 사용 중입니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [session])

  // 현재 월의 포커스 로드 및 월 변경 감지
  useEffect(() => {
    const currentMonthKey = getMonthKey(new Date())
    setMonthKey(currentMonthKey)

    try {
      const parsed = getMonthlyFocus()
      
      // 저장된 월이 현재 월과 다르면 리셋
      if (parsed.monthKey !== currentMonthKey) {
        const newFocus: MonthlyFocus = {
          monthKey: currentMonthKey,
          projectIds: [],
        }
        setMonthlyFocus(newFocus)
        setFocusedProjectIds([])
        setMonthResetNotice(true)
        // 5초 후 알림 제거
        setTimeout(() => setMonthResetNotice(false), 5000)
      } else {
        setFocusedProjectIds(parsed.projectIds || [])
      }
    } catch (err) {
      console.error('Failed to load monthly focus from localStorage:', err)
      // 에러 발생 시 기본값 설정
      const fallbackMonthKey = getMonthKey(new Date())
      const newFocus: MonthlyFocus = {
        monthKey: fallbackMonthKey,
        projectIds: [],
      }
      try {
        setMonthlyFocus(newFocus)
      } catch (e) {
        console.error('Failed to initialize monthly focus:', e)
      }
      setFocusedProjectIds([])
    }
  }, [])

  // URL에서 success 메시지 확인
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const created = params.get('created')
    if (created === 'true') {
      setSuccessMessage('프로젝트가 생성되었습니다.')
      // URL에서 쿼리 파라미터 제거
      window.history.replaceState({}, '', '/projects')
      // 3초 후 메시지 제거
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }, [])

  // 포커스 토글
  const handleToggleFocus = (projectId: string) => {
    const currentMonthKey = getMonthKey(new Date())
    
    if (focusedProjectIds.includes(projectId)) {
      // 해제
      const updated = focusedProjectIds.filter((id) => id !== projectId)
      setFocusedProjectIds(updated)
      const updatedFocus: MonthlyFocus = {
        monthKey: currentMonthKey,
        projectIds: updated,
      }
      try {
        setMonthlyFocus(updatedFocus)
      } catch (err) {
        console.error('Failed to save monthly focus:', err)
      }
    } else {
      // 선택 (최대 3개 체크)
      if (focusedProjectIds.length >= 3) {
        setMaxReachedWarning(true)
        setTimeout(() => setMaxReachedWarning(false), 3000)
        return
      }
      const updated = [...focusedProjectIds, projectId]
      setFocusedProjectIds(updated)
      const updatedFocus: MonthlyFocus = {
        monthKey: currentMonthKey,
        projectIds: updated,
      }
      try {
        setMonthlyFocus(updatedFocus)
      } catch (err) {
        console.error('Failed to save monthly focus:', err)
      }
    }
  }

  // 프로젝트 삭제
  const handleDelete = async (id: string) => {
    if (!session?.user?.id) return

    // 주간 작업에서 이 프로젝트와 연결된 작업 확인
    const weeklyPlan = getWeeklyPlan()
    let hasRelatedTasks = false
    
    for (const weekKey in weeklyPlan.weeks) {
      const weekTasks = weeklyPlan.weeks[weekKey]?.tasks || []
      if (weekTasks.some((task) => task.projectId === id)) {
        hasRelatedTasks = true
        break
      }
    }

    // 관련 작업이 있으면 사용자에게 선택권 제공
    let shouldDeleteTasks = false
    if (hasRelatedTasks) {
      // 프로젝트 삭제 확인
      if (!confirm('이 프로젝트를 삭제하시겠습니까?')) return
      
      // 업무 처리 방법 선택
      shouldDeleteTasks = confirm(
        '이 프로젝트에 연결된 업무가 있습니다. 함께 삭제할까요?\n\n확인: 업무도 함께 삭제\n취소: 업무는 남기기'
      )
    } else {
      // 관련 작업이 없으면 기존 동작 (즉시 삭제)
      if (!confirm('이 프로젝트를 삭제하시겠습니까?')) return
    }

    try {
      // 프로젝트 삭제 (Supabase)
      await deleteProject(id, session.user.id)
      
      // 로컬 상태 업데이트
      const updated = projects.filter((p) => p.id !== id)
      setProjects(updated)

      // 주간 작업 처리 (관련 작업이 있는 경우만)
      if (hasRelatedTasks) {
        const updatedWeeklyPlan: typeof weeklyPlan = { weeks: {} }
        for (const weekKey in weeklyPlan.weeks) {
          const weekTasks = weeklyPlan.weeks[weekKey]?.tasks || []
          if (shouldDeleteTasks) {
            // 관련 작업도 함께 삭제
            updatedWeeklyPlan.weeks[weekKey] = {
              tasks: weekTasks.filter((task) => task.projectId !== id),
            }
          } else {
            // 관련 작업은 남기되 projectId를 null로 설정
            updatedWeeklyPlan.weeks[weekKey] = {
              tasks: weekTasks.map((task) =>
                task.projectId === id ? { ...task, projectId: null } : task
              ),
            }
          }
        }
        setWeeklyPlan(updatedWeeklyPlan)
      }

      // 포커스에서도 제거
      if (focusedProjectIds.includes(id)) {
        const currentMonthKey = getMonthKey(new Date())
        const updatedFocusIds = focusedProjectIds.filter((fid) => fid !== id)
        setFocusedProjectIds(updatedFocusIds)
        
        const updatedFocus: MonthlyFocus = {
          monthKey: currentMonthKey,
          projectIds: updatedFocusIds,
        }
        setMonthlyFocus(updatedFocus)
      }
    } catch (err: any) {
      console.error('Failed to delete project:', err)
      alert('프로젝트 삭제에 실패했습니다: ' + (err?.message || '알 수 없는 오류'))
    }
  }

  // 상태별로 그룹화 및 포커스 분리
  const allDraftProjects = projects.filter((p) => p.status === 'draft')
  const focusedProjects = allDraftProjects.filter((p) => focusedProjectIds.includes(p.id))
  const nonFocusedProjects = allDraftProjects.filter((p) => !focusedProjectIds.includes(p.id))

  const groupedProjects = {
    draft: allDraftProjects,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>{t.pages.projectsTitle}</h1>
        <button
          onClick={() => router.push('/projects/new')}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          {t.messages.createProject}
        </button>
      </div>

      {successMessage && (
        <div
          style={{
            color: '#155724',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          {successMessage}
        </div>
      )}

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

      {/* 월 리셋 알림 */}
      {monthResetNotice && (
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
          {t.messages.monthlyFocusNotice}
        </div>
      )}

      {/* 최대 개수 경고 */}
      {maxReachedWarning && (
        <div
          style={{
            color: '#721c24',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f8d7da',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          최대 3개의 프로젝트만 선택할 수 있습니다.
        </div>
      )}

      {/* Monthly Focus 섹션 */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1rem',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: '#f9f9f9',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '500' }}>{t.messages.monthlyFocus}</h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#666' }}>
          {monthKey || getMonthKey(new Date())} · {t.messages.monthlyFocusMax}
        </p>
        <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
          선택된 프로젝트: {focusedProjectIds.length} / 3
        </div>
      </div>

      {/* This Month's Focus 섹션 */}
      {focusedProjects.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t.messages.monthlyFocus}</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem',
            }}
          >
            {focusedProjects.map((project) => (
              <div
                key={project.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #0070f3',
                  borderRadius: '4px',
                  backgroundColor: '#f0f8ff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={focusedProjectIds.includes(project.id)}
                      onChange={() => handleToggleFocus(project.id)}
                      style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        cursor: 'pointer',
                      }}
                    />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>{project.title}</h3>
                    <span
                      style={{
                        padding: '0.125rem 0.5rem',
                        backgroundColor: '#0070f3',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                      }}
                    >
                      {t.messages.focused}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(project.id)}
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
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                  {project.source && project.source.items ? (
                    <div>
                      <div style={{ marginBottom: '0.25rem' }}>Items: {project.source.items.length}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>
                        {project.source.items.slice(0, 3).map((item, idx) => (
                          <span key={idx}>
                            S{item.strategy_index + 1}-A{item.action_index + 1}
                            {idx < Math.min(2, project.source.items.length - 1) && ', '}
                          </span>
                        ))}
                        {project.source.items.length > 3 && '...'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      Source: Strategy {project.source_strategy_index !== undefined ? project.source_strategy_index + 1 : 'N/A'}, Action{' '}
                      {project.source_action_index !== undefined ? project.source_action_index + 1 : 'N/A'}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>
                  Created: {new Date(project.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft 상태 프로젝트 (포커스되지 않은 프로젝트만 표시) */}
      {nonFocusedProjects.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>초안</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem',
            }}
          >
            {nonFocusedProjects.map((project) => {
              const isFocused = focusedProjectIds.includes(project.id)
              return (
                <div
                  key={project.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={focusedProjectIds.includes(project.id)}
                        onChange={() => handleToggleFocus(project.id)}
                        style={{
                          width: '1.25rem',
                          height: '1.25rem',
                          cursor: 'pointer',
                        }}
                      />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>{project.title}</h3>
                      {isFocused && (
                        <span
                          style={{
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#0070f3',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                          }}
                        >
                          {t.messages.focused}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={() => router.push(`/projects/${project.id}/edit`)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#0070f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
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
                  <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                    {project.source && project.source.items ? (
                      <div>
                        <div style={{ marginBottom: '0.25rem' }}>Items: {project.source.items.length}</div>
                        <div style={{ fontSize: '0.75rem', color: '#999' }}>
                          {project.source.items.slice(0, 3).map((item, idx) => (
                            <span key={idx}>
                              S{item.strategy_index + 1}-A{item.action_index + 1}
                              {idx < Math.min(2, project.source.items.length - 1) && ', '}
                            </span>
                          ))}
                          {project.source.items.length > 3 && '...'}
                        </div>
                      </div>
                    ) : (
                      <div>
                        Source: Strategy {project.source_strategy_index !== undefined ? project.source_strategy_index + 1 : 'N/A'}, Action{' '}
                        {project.source_action_index !== undefined ? project.source_action_index + 1 : 'N/A'}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>
                    Created: {new Date(project.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {projects.length === 0 && (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            color: '#666',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem' }}>{t.messages.projectsEmpty}</p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>{t.messages.projectsEmptyHelper}</p>
        </div>
      )}

      {/* Step Navigation */}
      <StepNav
        prev={{
          href: '/projects/new',
          label: '← 이전 단계(프로젝트 생성)',
        }}
        next={{
          href: '/focus',
          label: '다음 단계(먼슬리) →',
          disabled: projects.length === 0,
          hint: 'Project를 먼저 만들어 주세요.',
        }}
      />
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <RequireAuth>
      <ProjectsPageContent />
    </RequireAuth>
  )
}

