'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { StepNav } from '@/components/StepNav'
import { useAuth } from '@/components/auth/AuthProvider'
import { getMonthKey } from '@/lib/keys'
import { loadProjects, AppProject } from '@/lib/projects'
import { loadMonthlyFocus, saveMonthlyFocus } from '@/lib/monthlyFocus'

// Use AppProject type from projects.ts
type Project = AppProject

function FocusPageContent() {
  const router = useRouter()
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [monthKey, setMonthKey] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [monthResetNotice, setMonthResetNotice] = useState(false)
  const [maxReachedWarning, setMaxReachedWarning] = useState(false)
  const [supabaseError, setSupabaseError] = useState<string | null>(null)

  // Load projects from Supabase
  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        const result = await loadProjects(session.user.id)
        setProjects(result.projects)
      } catch (err) {
        console.error('Failed to load projects:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [session])

  // Load monthly focus from Supabase
  useEffect(() => {
    if (!session?.user?.id) return

    const currentMonthKey = getMonthKey(new Date())
    setMonthKey(currentMonthKey)

    const loadFocus = async () => {
      try {
        setSupabaseError(null)
        const result = await loadMonthlyFocus(session.user.id, currentMonthKey)
        
        if (result.focus) {
          setSelectedIds(result.focus.projectIds || [])
        } else {
          // No focus exists for this month, start with empty
          setSelectedIds([])
        }

        if (!result.fromSupabase && result.error) {
          setSupabaseError('Supabase 연결 실패. 로컬 데이터를 사용 중입니다.')
        }
      } catch (err) {
        console.error('Failed to load monthly focus:', err)
        setSupabaseError('월간 포커스 로드 실패. 로컬 데이터를 사용 중입니다.')
        setSelectedIds([])
      }
    }

    loadFocus()
  }, [session])

  // 선택된 프로젝트가 삭제되었는지 확인하고 정리
  useEffect(() => {
    if (!session?.user?.id) return
    if (projects.length === 0 || selectedIds.length === 0) return

    const validIds = projects.map((p) => p.id)
    const filteredIds = selectedIds.filter((id) => validIds.includes(id))

    if (filteredIds.length !== selectedIds.length) {
      // 삭제된 프로젝트가 선택 목록에 있으면 제거
      const currentMonthKey = getMonthKey(new Date())
      setSelectedIds(filteredIds)
      
      // Save cleaned up focus to Supabase
      saveMonthlyFocus(currentMonthKey, filteredIds, session.user.id, validIds).catch((err) => {
        console.error('Failed to update monthly focus after cleanup:', err)
      })
    }
  }, [projects, selectedIds, session])

  // 프로젝트 선택/해제 핸들러
  const handleToggle = async (projectId: string) => {
    if (!session?.user?.id) return

    const currentMonthKey = getMonthKey(new Date())
    
    if (selectedIds.includes(projectId)) {
      // 해제
      const updated = selectedIds.filter((id) => id !== projectId)
      setSelectedIds(updated)
      
      try {
        const validProjectIds = projects.map((p) => p.id)
        await saveMonthlyFocus(currentMonthKey, updated, session.user.id, validProjectIds)
        setSavedFeedback(true)
        setTimeout(() => setSavedFeedback(false), 2000)
      } catch (err: any) {
        console.error('Failed to save monthly focus:', err)
        alert('저장에 실패했습니다: ' + (err?.message || '알 수 없는 오류'))
        // Revert on error
        setSelectedIds(selectedIds)
      }
    } else {
      // 선택 (최대 3개 체크)
      if (selectedIds.length >= 3) {
        setMaxReachedWarning(true)
        setTimeout(() => setMaxReachedWarning(false), 3000)
        return
      }
      const updated = [...selectedIds, projectId]
      setSelectedIds(updated)
      
      try {
        const validProjectIds = projects.map((p) => p.id)
        await saveMonthlyFocus(currentMonthKey, updated, session.user.id, validProjectIds)
        setSavedFeedback(true)
        setTimeout(() => setSavedFeedback(false), 2000)
      } catch (err: any) {
        console.error('Failed to save monthly focus:', err)
        alert('저장에 실패했습니다: ' + (err?.message || '알 수 없는 오류'))
        // Revert on error
        setSelectedIds(selectedIds)
      }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Monthly Focus</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.875rem' }}>
        {monthKey || getMonthKey(new Date())}
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
          새 달이 시작되어 포커스가 초기화되었습니다.
        </div>
      )}

      {/* 저장 피드백 */}
      {savedFeedback && (
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
          저장되었습니다.
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

      {/* 선택 개수 표시 */}
      <div style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: '#666' }}>
        선택된 프로젝트: {selectedIds.length} / 3
      </div>

      {/* 프로젝트 목록 */}
      {projects.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            color: '#666',
          }}
        >
          <p style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>프로젝트를 먼저 생성하세요</p>
          <a
            href="/projects/new"
            style={{
              color: '#0070f3',
              textDecoration: 'underline',
              fontSize: '0.875rem',
            }}
          >
            프로젝트 생성하기
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {projects.map((project) => {
            const isSelected = selectedIds.includes(project.id)
            const isDisabled = !isSelected && selectedIds.length >= 3

            return (
              <label
                key={project.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? '#f0f8ff' : 'white',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(project.id)}
                  disabled={isDisabled}
                  style={{
                    marginRight: '0.75rem',
                    width: '1.25rem',
                    height: '1.25rem',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>{project.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>
                    Created: {new Date(project.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      )}

      {/* Step Navigation */}
      <StepNav
        prev={{
          href: '/projects',
          label: '← 이전 단계(프로젝트)',
        }}
        next={{
          href: '/weekly',
          label: '다음 단계(위클리) →',
          disabled: selectedIds.length === 0,
          hint: '이번 달 집중할 프로젝트를 선택해 주세요.',
        }}
      />
    </div>
  )
}

export default function FocusPage() {
  return (
    <RequireAuth>
      <FocusPageContent />
    </RequireAuth>
  )
}

