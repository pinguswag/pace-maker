'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { getMonthKey } from '@/lib/keys'
import { getProjects, getMonthlyFocus, setMonthlyFocus } from '@/lib/mockStore'

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

// Monthly Focus 타입 정의
interface MonthlyFocus {
  monthKey: string // "YYYY-MM"
  projectIds: string[]
}

function FocusPageContent() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [monthKey, setMonthKey] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [monthResetNotice, setMonthResetNotice] = useState(false)
  const [maxReachedWarning, setMaxReachedWarning] = useState(false)

  // localStorage에서 프로젝트 로드
  useEffect(() => {
    try {
      const parsed = getProjects<Project[]>()
      setProjects(Array.isArray(parsed) ? parsed : [])
    } catch (err) {
      console.error('Failed to load projects from localStorage:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 월별 포커스 로드 및 월 변경 감지
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
        setSelectedIds([])
        setMonthResetNotice(true)
        // 5초 후 알림 제거
        setTimeout(() => setMonthResetNotice(false), 5000)
      } else {
        setSelectedIds(parsed.projectIds || [])
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
      setSelectedIds([])
    }
  }, [])

  // 선택된 프로젝트가 삭제되었는지 확인하고 정리
  useEffect(() => {
    if (projects.length === 0 || selectedIds.length === 0) return

    const validIds = projects.map((p) => p.id)
    const filteredIds = selectedIds.filter((id) => validIds.includes(id))

    if (filteredIds.length !== selectedIds.length) {
      // 삭제된 프로젝트가 선택 목록에 있으면 제거
      setSelectedIds(filteredIds)
      const currentMonthKey = getMonthKey(new Date())
      const updatedFocus: MonthlyFocus = {
        monthKey: currentMonthKey,
        projectIds: filteredIds,
      }
      try {
        setMonthlyFocus(updatedFocus)
      } catch (err) {
        console.error('Failed to update monthly focus after cleanup:', err)
      }
    }
  }, [projects, selectedIds])

  // 프로젝트 선택/해제 핸들러
  const handleToggle = (projectId: string) => {
    const currentMonthKey = getMonthKey(new Date())
    
    if (selectedIds.includes(projectId)) {
      // 해제
      const updated = selectedIds.filter((id) => id !== projectId)
      setSelectedIds(updated)
      const updatedFocus: MonthlyFocus = {
        monthKey: currentMonthKey,
        projectIds: updated,
      }
      try {
        setMonthlyFocus(updatedFocus)
        setSavedFeedback(true)
        setTimeout(() => setSavedFeedback(false), 2000)
      } catch (err) {
        console.error('Failed to save monthly focus:', err)
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
      const updatedFocus: MonthlyFocus = {
        monthKey: currentMonthKey,
        projectIds: updated,
      }
      try {
        setMonthlyFocus(updatedFocus)
        setSavedFeedback(true)
        setTimeout(() => setSavedFeedback(false), 2000)
      } catch (err) {
        console.error('Failed to save monthly focus:', err)
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
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Monthly Focus</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.875rem' }}>
        {monthKey || getMonthKey(new Date())}
      </p>

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

