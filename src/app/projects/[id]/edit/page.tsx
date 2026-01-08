'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase/client'
import { t } from '@/lib/uiText/ko'
import { getProjects, setProjects as saveProjects } from '@/lib/mockStore'

// 선택된 액션 타입
interface SelectedAction {
  strategy_index: number
  action_index: number
  strategy_text: string
  action_text: string
}

// 수동 추가 항목 타입
interface ManualItem {
  id: string
  title: string
}

// Project 타입
interface Project {
  id: string
  title: string
  status: 'draft'
  created_at: string
  source?: {
    yearlyGoal: string
    items: Array<{
      id: string
      title: string
      source: 'mandarat' | 'manual'
      strategy_index?: number
      action_index?: number
      strategy_text?: string
      action_text?: string
    }>
  }
  source_strategy_index?: number
  source_action_index?: number
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

function ProjectEditPageContent() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string
  const { session } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [yearlyGoal, setYearlyGoal] = useState('')
  const [strategies, setStrategies] = useState<string[]>(Array(8).fill(''))
  const [actions, setActions] = useState<string[][]>(Array(8).fill(null).map(() => Array(8).fill('')))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [selectedActions, setSelectedActions] = useState<SelectedAction[]>([])
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [existingProjects, setExistingProjects] = useState<Project[]>([])
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  const [manualItemInput, setManualItemInput] = useState('')

  // 프로젝트 로드
  useEffect(() => {
    try {
      const parsed = getProjects<Project[]>()
      const projects = Array.isArray(parsed) ? parsed : []
      setExistingProjects(projects)
      
      const foundProject = projects.find((p: Project) => p.id === projectId)
      if (foundProject) {
        setProject(foundProject)
        setProjectTitle(foundProject.title)
        
        // 현재 프로젝트의 액션들을 초기 선택으로 설정
        if (foundProject.source && foundProject.source.items) {
          setSelectedActions(
            foundProject.source.items.map((item) => ({
              strategy_index: item.strategy_index,
              action_index: item.action_index,
              strategy_text: item.strategy_text,
              action_text: item.action_text,
            }))
          )
        } else if ('source_strategy_index' in foundProject && 'source_action_index' in foundProject) {
          // 기존 형식 호환성
          const strategyIdx = (foundProject as any).source_strategy_index
          const actionIdx = (foundProject as any).source_action_index
          if (strategyIdx !== undefined && actionIdx !== undefined) {
            // Mandarat 데이터가 로드된 후에 텍스트를 채워야 함
            // 일단 인덱스만 저장
          }
        }
      }
    } catch (err) {
      console.error('Failed to load project:', err)
      setError('프로젝트를 불러오는 중 오류가 발생했습니다.')
    }
  }, [projectId])

  // Mandarat 데이터 로드
  const loadMandaratData = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      setError(null)
      setSetupRequired(false)

      const userId = session.user.id

      // 1. Board 로드
      const { data: boardData, error: boardError } = await supabase
        .from('mandarat_boards')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single()

      if (isTableMissingError(boardError)) {
        setSetupRequired(true)
        setLoading(false)
        return
      }

      if (boardError && boardError.code !== 'PGRST116') {
        setError(boardError.message)
        setLoading(false)
        return
      }

      if (boardData) {
        setYearlyGoal(boardData.yearly_goal || '')
      }

      // 2. Strategies 로드
      if (boardData) {
        const { data: strategiesData, error: strategiesError } = await supabase
          .from('mandarat_strategies')
          .select('*')
          .eq('board_id', boardData.id)
          .order('strategy_index', { ascending: true })

        if (isTableMissingError(strategiesError)) {
          setSetupRequired(true)
          setLoading(false)
          return
        }

        if (strategiesError) {
          setError(strategiesError.message)
          setLoading(false)
          return
        }

        const strategiesArray = Array(8).fill('')
        if (strategiesData) {
          strategiesData.forEach((s) => {
            if (s.strategy_index >= 0 && s.strategy_index < 8) {
              strategiesArray[s.strategy_index] = s.text_value || ''
            }
          })
        }
        setStrategies(strategiesArray)

        // 3. Actions 로드
        const { data: actionsData, error: actionsError } = await supabase
          .from('mandarat_actions')
          .select('*')
          .eq('board_id', boardData.id)
          .order('strategy_index', { ascending: true })
          .order('action_index', { ascending: true })

        if (isTableMissingError(actionsError)) {
          setSetupRequired(true)
          setLoading(false)
          return
        }

        if (actionsError) {
          setError(actionsError.message)
          setLoading(false)
          return
        }

        const actionsArray: string[][] = Array(8)
          .fill(null)
          .map(() => Array(8).fill(''))

        if (actionsData) {
          actionsData.forEach((a) => {
            if (
              a.strategy_index >= 0 &&
              a.strategy_index < 8 &&
              a.action_index >= 0 &&
              a.action_index < 8
            ) {
              actionsArray[a.strategy_index][a.action_index] = a.text_value || ''
            }
          })
        }
        setActions(actionsArray)

        // Mandarat 데이터 로드 후, 선택된 액션의 텍스트를 최신 값으로 업데이트
        if (project && project.source && project.source.items) {
          const mandaratItems = project.source.items.filter(
            (item) => item.source === 'mandarat' && item.strategy_index !== undefined && item.action_index !== undefined
          )
          const updatedSelectedActions = mandaratItems.map((item) => {
            const latestActionText = actionsArray[item.strategy_index!]?.[item.action_index!] || item.action_text || item.title
            const latestStrategyText = strategiesArray[item.strategy_index!] || item.strategy_text || ''
            return {
              strategy_index: item.strategy_index!,
              action_index: item.action_index!,
              strategy_text: latestStrategyText,
              action_text: latestActionText,
            }
          })
          setSelectedActions(updatedSelectedActions)
        }
      }
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, project])

  useEffect(() => {
    loadMandaratData()
  }, [loadMandaratData])

  // 액션이 다른 프로젝트에 포함되어 있는지 확인 (현재 편집 중인 프로젝트 제외)
  const isActionUsedByOtherProject = (strategyIndex: number, actionIndex: number): boolean => {
    return existingProjects.some((p) => {
      if (p.id === projectId) return false // 현재 편집 중인 프로젝트는 제외
      
      if (p.source && p.source.items) {
        return p.source.items.some(
          (item) => item.strategy_index === strategyIndex && item.action_index === actionIndex
        )
      }
      // 기존 형식 호환성
      if ('source_strategy_index' in p && 'source_action_index' in p) {
        return (
          (p as any).source_strategy_index === strategyIndex &&
          (p as any).source_action_index === actionIndex
        )
      }
      return false
    })
  }

  // 선택 상태 확인 헬퍼
  const isActionSelected = (strategyIndex: number, actionIndex: number): boolean => {
    return selectedActions.some(
      (a) => a.strategy_index === strategyIndex && a.action_index === actionIndex
    )
  }

  // 필터링된 액션 확인 헬퍼
  const isActionVisible = (strategyIndex: number, actionIndex: number): boolean => {
    const actionText = actions[strategyIndex]?.[actionIndex] || ''
    const strategyText = strategies[strategyIndex] || ''
    const query = searchQuery.toLowerCase().trim()

    // 검색 필터
    if (query) {
      const matchesAction = actionText.toLowerCase().includes(query)
      const matchesStrategy = strategyText.toLowerCase().includes(query)
      if (!matchesAction && !matchesStrategy) return false
    }

    // 선택된 항목만 보기 필터
    if (showSelectedOnly && !isActionSelected(strategyIndex, actionIndex)) {
      return false
    }

    return true
  }

  // 전략의 선택 개수 계산
  const getSelectedCountForStrategy = (strategyIndex: number): number => {
    return selectedActions.filter((a) => a.strategy_index === strategyIndex).length
  }

  // 전략의 표시 가능한 액션 개수 계산
  const getVisibleActionsForStrategy = (strategyIndex: number): Array<{ strategyIndex: number; actionIndex: number }> => {
    const visible: Array<{ strategyIndex: number; actionIndex: number }> = []
    for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
      if (isActionVisible(strategyIndex, actionIndex)) {
        visible.push({ strategyIndex, actionIndex })
      }
    }
    return visible
  }

  // 선택 항목 제거
  const removeSelectedAction = (strategyIndex: number, actionIndex: number) => {
    setSelectedActions(
      selectedActions.filter(
        (a) => !(a.strategy_index === strategyIndex && a.action_index === actionIndex)
      )
    )
  }

  // 체크박스 토글
  const toggleAction = (strategyIndex: number, actionIndex: number) => {
    // 다른 프로젝트에 포함된 액션은 선택 불가
    if (isActionUsedByOtherProject(strategyIndex, actionIndex)) return

    const existing = selectedActions.find(
      (a) => a.strategy_index === strategyIndex && a.action_index === actionIndex
    )

    if (existing) {
      setSelectedActions(selectedActions.filter((a) => a !== existing))
    } else {
      const actionText = actions[strategyIndex]?.[actionIndex] || ''
      const strategyText = strategies[strategyIndex] || ''
      setSelectedActions([
        ...selectedActions,
        {
          strategy_index: strategyIndex,
          action_index: actionIndex,
          strategy_text: strategyText,
          action_text: actionText,
        },
      ])
    }
  }

  // 전략의 모든 표시 가능한 액션 선택
  const selectAllVisibleInStrategy = (strategyIndex: number) => {
    const visible = getVisibleActionsForStrategy(strategyIndex)
    const newSelections: SelectedAction[] = []

    visible.forEach(({ strategyIndex: sIdx, actionIndex: aIdx }) => {
      // 다른 프로젝트에 포함된 액션은 선택 불가
      if (isActionUsedByOtherProject(sIdx, aIdx)) return
      if (!isActionSelected(sIdx, aIdx)) {
        const actionText = actions[sIdx]?.[aIdx] || ''
        const strategyText = strategies[sIdx] || ''
        newSelections.push({
          strategy_index: sIdx,
          action_index: aIdx,
          strategy_text: strategyText,
          action_text: actionText,
        })
      }
    })

    if (newSelections.length > 0) {
      setSelectedActions([...selectedActions, ...newSelections])
    }
  }

  // 전략의 모든 액션 선택 해제
  const clearStrategy = (strategyIndex: number) => {
    setSelectedActions(selectedActions.filter((a) => a.strategy_index !== strategyIndex))
  }

  // 모든 표시 가능한 액션 선택
  const selectAllVisible = () => {
    const newSelections: SelectedAction[] = []

    for (let strategyIndex = 0; strategyIndex < 8; strategyIndex++) {
      for (let actionIndex = 0; actionIndex < 8; actionIndex++) {
        // 다른 프로젝트에 포함된 액션은 선택 불가
        if (isActionUsedByOtherProject(strategyIndex, actionIndex)) continue
        if (isActionVisible(strategyIndex, actionIndex) && !isActionSelected(strategyIndex, actionIndex)) {
          const actionText = actions[strategyIndex]?.[actionIndex] || ''
          const strategyText = strategies[strategyIndex] || ''
          newSelections.push({
            strategy_index: strategyIndex,
            action_index: actionIndex,
            strategy_text: strategyText,
            action_text: actionText,
          })
        }
      }
    }

    if (newSelections.length > 0) {
      setSelectedActions([...selectedActions, ...newSelections])
    }
  }

  // 모든 선택 해제
  const clearAll = () => {
    setSelectedActions([])
  }

  // 저장
  const handleSave = async () => {
    if (!projectTitle.trim()) {
      setError('프로젝트 이름을 입력해주세요.')
      return
    }

    if (selectedActions.length === 0 && manualItems.length === 0) {
      setError('최소 하나의 항목(Mandarat 액션 또는 수동 업무)을 선택해주세요.')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Mandarat 항목들
      const mandaratItems = selectedActions.map((a) => {
        const latestActionText = actions[a.strategy_index]?.[a.action_index] || a.action_text
        const latestStrategyText = strategies[a.strategy_index] || a.strategy_text
        return {
          id: `mandarat_${a.strategy_index}_${a.action_index}_${Date.now()}`,
          title: latestActionText,
          source: 'mandarat' as const,
          strategy_index: a.strategy_index,
          action_index: a.action_index,
          strategy_text: latestStrategyText,
          action_text: latestActionText,
        }
      })

      // 수동 항목들
      const manualItemsFormatted = manualItems.map((item) => ({
        id: item.id,
        title: item.title,
        source: 'manual' as const,
      }))

      // 프로젝트 업데이트
      const updatedProject: Project = {
        ...project!,
        title: projectTitle.trim(),
        source: {
          yearlyGoal: yearlyGoal,
          items: [...mandaratItems, ...manualItemsFormatted],
        },
      }

      // localStorage 업데이트
      const updatedProjects = existingProjects.map((p) =>
        p.id === projectId ? updatedProject : p
      )
      saveProjects(updatedProjects)

      // 성공 메시지와 함께 리다이렉트
      router.push('/projects?edited=true')
    } catch (err) {
      setError('프로젝트 저장 중 오류가 발생했습니다.')
      setSaving(false)
    }
  }

  // 프로젝트를 찾을 수 없는 경우
  if (!loading && !project) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>프로젝트 편집</h1>
        <div
          style={{
            padding: '2rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <p style={{ marginBottom: '1.5rem' }}>프로젝트를 찾을 수 없습니다.</p>
          <button
            onClick={() => router.push('/projects')}
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
            프로젝트 목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // Setup Required 화면
  if (setupRequired) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>프로젝트 편집</h1>
        <div
          style={{
            padding: '2rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>데이터베이스 설정이 필요합니다</h2>
          <p style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
            Projects 기능을 사용하려면 Mandarat 데이터가 필요합니다. 먼저 Mandarat 페이지에서 데이터를 설정해주세요.
          </p>
          <button
            onClick={() => router.push('/mandarat')}
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
            Mandarat으로 이동
          </button>
        </div>
      </div>
    )
  }

  if (loading || !project) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>{t.common.loading}</p>
      </div>
    )
  }

  // 현재 포함된 액션들을 전략별로 그룹화
  const currentActionsByStrategy = selectedActions.reduce((acc, action) => {
    if (!acc[action.strategy_index]) {
      acc[action.strategy_index] = []
    }
    acc[action.strategy_index].push(action)
    return acc
  }, {} as Record<number, SelectedAction[]>)

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>프로젝트 편집</h1>

      {error && (
        <div
          style={{
            color: '#dc3545',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f8d7da',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Section A: Project Info */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: 'white' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '500' }}>프로젝트 정보</h2>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
            프로젝트 이름 *
          </label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="프로젝트 제목을 입력하세요"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
            }}
          />
        </div>
      </div>

      {/* Section B: Current Actions */}
      {selectedActions.length > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: 'white' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '500' }}>포함된 액션 (현재)</h2>
          {Object.entries(currentActionsByStrategy).map(([strategyIdx, actions]) => {
            const strategyIndex = parseInt(strategyIdx)
            const strategyText = strategies[strategyIndex] || `Strategy ${strategyIndex + 1}`
            return (
              <div key={strategyIndex} style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
                  {strategyText}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {actions.map((action) => (
                    <div
                      key={`${action.strategy_index}-${action.action_index}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                      }}
                    >
                      <span style={{ fontSize: '0.875rem' }}>
                        Action {action.action_index + 1}: {action.action_text || '(비어있음)'}
                      </span>
                      <button
                        onClick={() => removeSelectedAction(action.strategy_index, action.action_index)}
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
                        {t.common.remove}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Section C: Add More Actions */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e0e0e0', borderRadius: '4px', backgroundColor: 'white' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '500' }}>Mandarat에서 액션 추가</h2>

        {/* Yearly Goal Preview */}
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>Yearly Goal</h3>
          <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>{yearlyGoal || '(비어있음)'}</p>
        </div>

        {/* Search and Filter Controls */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="액션 검색..."
              style={{
                flex: '1',
                minWidth: '200px',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => setShowSelectedOnly(e.target.checked)}
              />
              <span>선택된 항목만 보기</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={selectAllVisible}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f5f5f5',
                color: '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              전체 선택
            </button>
            <button
              onClick={clearAll}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f5f5f5',
                color: '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              전체 해제
            </button>
          </div>
        </div>

        {/* Strategies Accordion */}
        <div style={{ marginBottom: '2rem' }}>
          {Array.from({ length: 8 }, (_, strategyIndex) => {
            const strategyText = strategies[strategyIndex] || ''
            const hasSelected = selectedActions.some((a) => a.strategy_index === strategyIndex)
            const selectedCount = getSelectedCountForStrategy(strategyIndex)
            const visibleActions = getVisibleActionsForStrategy(strategyIndex)
            const hasVisibleActions = visibleActions.length > 0

            if (!hasVisibleActions) return null

            return (
              <div
                key={strategyIndex}
                style={{
                  marginBottom: '1rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: hasSelected ? '#e3f2fd' : '#f5f5f5',
                    fontWeight: '500',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <span>
                    Strategy {strategyIndex + 1}: {strategyText || '(비어있음)'} ({selectedCount}/8 선택됨)
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => selectAllVisibleInStrategy(strategyIndex)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'white',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      전체 선택
                    </button>
                    <button
                      onClick={() => clearStrategy(strategyIndex)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: 'white',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      {t.messages.clear}
                    </button>
                  </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'white' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Array.from({ length: 8 }, (_, actionIndex) => {
                      if (!isActionVisible(strategyIndex, actionIndex)) return null

                      const actionText = actions[strategyIndex]?.[actionIndex] || ''
                      const isSelected = isActionSelected(strategyIndex, actionIndex)
                      const isUsedByOther = isActionUsedByOtherProject(strategyIndex, actionIndex)

                      return (
                        <label
                          key={actionIndex}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: isUsedByOther ? 'not-allowed' : 'pointer',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? '#e3f2fd' : isUsedByOther ? '#f5f5f5' : 'transparent',
                            opacity: isUsedByOther ? 0.6 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isUsedByOther}
                            onChange={() => toggleAction(strategyIndex, actionIndex)}
                            style={{ cursor: isUsedByOther ? 'not-allowed' : 'pointer' }}
                          />
                          <span style={{ fontSize: '0.875rem', flex: 1 }}>
                            Action {actionIndex + 1}: {actionText || '(비어있음)'}
                          </span>
                          {isUsedByOther && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.5rem',
                                backgroundColor: '#ffc107',
                                color: '#333',
                                borderRadius: '4px',
                                fontWeight: '500',
                              }}
                            >
                              이미 다른 프로젝트에 포함됨
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty State when Show Selected Only is ON and nothing selected */}
        {showSelectedOnly && selectedActions.length === 0 && (
          <div
            style={{
              padding: '3rem',
              textAlign: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              color: '#666',
              marginBottom: '2rem',
            }}
          >
            <p style={{ margin: 0, fontSize: '1rem' }}>선택된 항목이 없습니다.</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>"선택된 항목만 보기" 필터를 해제하거나 항목을 선택해주세요.</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={() => router.push('/projects')}
          disabled={saving}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'white',
            color: '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          {t.common.cancel}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !projectTitle.trim() || (selectedActions.length === 0 && manualItems.length === 0)}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: saving || !projectTitle.trim() || (selectedActions.length === 0 && manualItems.length === 0) ? '#e0e0e0' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving || !projectTitle.trim() || (selectedActions.length === 0 && manualItems.length === 0) ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          {saving ? '저장 중...' : t.common.save}
        </button>
      </div>
    </div>
  )
}

export default function ProjectEditPage() {
  return (
    <RequireAuth>
      <ProjectEditPageContent />
    </RequireAuth>
  )
}
