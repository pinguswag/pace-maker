'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { StepNav } from '@/components/StepNav'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase/client'
import { loadProjects, createProject, AppProject } from '@/lib/projects'

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

// Use AppProject type from projects.ts
type Project = AppProject

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

function ProjectsNewPageContent() {
  const router = useRouter()
  const { session } = useAuth()
  const [yearlyGoal, setYearlyGoal] = useState('')
  const [strategies, setStrategies] = useState<string[]>(Array(8).fill(''))
  const [actions, setActions] = useState<string[][]>(Array(8).fill(null).map(() => Array(8).fill('')))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [selectedActions, setSelectedActions] = useState<SelectedAction[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')
  const [existingProjects, setExistingProjects] = useState<Project[]>([])
  const [manualItems, setManualItems] = useState<ManualItem[]>([])
  const [manualItemInput, setManualItemInput] = useState('')

  // Load existing projects
  useEffect(() => {
    if (!session?.user?.id) return
    
    const loadExisting = async () => {
      try {
        const result = await loadProjects(session.user.id)
        setExistingProjects(result.projects)
      } catch (err) {
        console.error('Failed to load existing projects:', err)
      }
    }
    
    loadExisting()
  }, [session])

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
      }
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    loadMandaratData()
  }, [loadMandaratData])


  // 액션이 이미 프로젝트에 포함되어 있는지 확인
  const isActionAlreadyInProject = (strategyIndex: number, actionIndex: number): boolean => {
    return existingProjects.some((project) => {
      if (project.source && project.source.items) {
        return project.source.items.some(
          (item) => item.strategy_index === strategyIndex && item.action_index === actionIndex
        )
      }
      // 기존 형식 호환성 (source_strategy_index, source_action_index)
      if ('source_strategy_index' in project && 'source_action_index' in project) {
        return (
          (project as any).source_strategy_index === strategyIndex &&
          (project as any).source_action_index === actionIndex
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
    // 이미 프로젝트에 포함된 액션은 선택 불가
    if (isActionAlreadyInProject(strategyIndex, actionIndex)) return

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
      // 이미 프로젝트에 포함된 액션은 선택 불가
      if (isActionAlreadyInProject(sIdx, aIdx)) return
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
        // 이미 프로젝트에 포함된 액션은 선택 불가
        if (isActionAlreadyInProject(strategyIndex, actionIndex)) continue
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

  // 수동 항목 추가
  const handleAddManualItem = () => {
    const title = manualItemInput.trim()
    if (!title) return

    // 중복 체크 (같은 프로젝트 내에서)
    const isDuplicate = manualItems.some(
      (item) => item.title.toLowerCase().trim() === title.toLowerCase().trim()
    )
    if (isDuplicate) {
      setError('이미 추가된 업무입니다.')
      return
    }

    const newItem: ManualItem = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title,
    }

    setManualItems([...manualItems, newItem])
    setManualItemInput('')
    setError(null)
  }

  // 수동 항목 제거
  const handleRemoveManualItem = (id: string) => {
    setManualItems(manualItems.filter((item) => item.id !== id))
  }

  // Next 버튼 클릭
  const handleNext = () => {
    if (selectedActions.length === 0 && manualItems.length === 0) return
    setShowConfirm(true)
  }

  // Back 버튼 클릭
  const handleBack = () => {
    setShowConfirm(false)
  }

  // 프로젝트 생성
  const handleCreate = async () => {
    if (selectedActions.length === 0 && manualItems.length === 0) {
      setError('최소 하나의 항목(Mandarat 액션 또는 수동 업무)을 선택해주세요.')
      return
    }
    if (!projectTitle.trim()) {
      setError('프로젝트 이름을 입력해주세요.')
      return
    }

    try {
      setCreating(true)

      // Mandarat 항목들
      const mandaratItems = selectedActions.map((a) => ({
        id: `mandarat_${a.strategy_index}_${a.action_index}_${Date.now()}`,
        title: a.action_text,
        source: 'mandarat' as const,
        strategy_index: a.strategy_index,
        action_index: a.action_index,
        strategy_text: a.strategy_text,
        action_text: a.action_text,
      }))

      // 수동 항목들
      const manualItemsFormatted = manualItems.map((item) => ({
        id: item.id,
        title: item.title,
        source: 'manual' as const,
      }))

      if (!session?.user?.id) {
        setError('로그인이 필요합니다.')
        setCreating(false)
        return
      }

      // Convert items to source_items format (only mandarat items, manual items are stored differently)
      const sourceItems = mandaratItems.map((item) => ({
        strategy_index: item.strategy_index,
        action_index: item.action_index,
        strategy_text: item.strategy_text,
        action_text: item.action_text,
      }))

      // Create project in Supabase
      const newProject = await createProject(
        {
          title: projectTitle.trim(),
          status: 'draft',
          source: {
            yearlyGoal: yearlyGoal,
            items: sourceItems,
          },
        },
        session.user.id
      )

      // 성공 메시지와 함께 리다이렉트
      router.push('/projects?created=true')
    } catch (err) {
      setError('프로젝트 생성 중 오류가 발생했습니다.')
      setCreating(false)
    }
  }

  // Setup Required 화면
  if (setupRequired) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>Create Projects</h1>
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

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Create Projects</h1>

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

      {/* Yearly Goal Preview */}
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>Yearly Goal</h2>
        <p style={{ margin: 0, color: '#666' }}>{yearlyGoal || '(비어있음)'}</p>
      </div>

      {!showConfirm ? (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Left: Selection Area */}
          <div style={{ flex: '1', minWidth: 0 }}>
            {/* Search and Filter Controls */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search actions..."
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
                <span>Show selected only</span>
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
                Select all visible
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
                Clear all
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

              // 표시할 액션이 없으면 섹션 숨기기
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
                      Strategy {strategyIndex + 1}: {strategyText || '(비어있음)'} ({selectedCount}/8 selected)
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
                        Select all
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
                        Clear
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '1rem', backgroundColor: 'white' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Array.from({ length: 8 }, (_, actionIndex) => {
                        // 필터링: 표시되지 않으면 렌더링하지 않음
                        if (!isActionVisible(strategyIndex, actionIndex)) return null

                        const actionText = actions[strategyIndex]?.[actionIndex] || ''
                        const isSelected = isActionSelected(strategyIndex, actionIndex)
                        const isAlreadyInProject = isActionAlreadyInProject(strategyIndex, actionIndex)

                        return (
                          <label
                            key={actionIndex}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: isAlreadyInProject ? 'not-allowed' : 'pointer',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? '#e3f2fd' : isAlreadyInProject ? '#f5f5f5' : 'transparent',
                              opacity: isAlreadyInProject ? 0.6 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isAlreadyInProject}
                              onChange={() => toggleAction(strategyIndex, actionIndex)}
                              style={{ cursor: isAlreadyInProject ? 'not-allowed' : 'pointer' }}
                            />
                            <span style={{ fontSize: '0.875rem', flex: 1 }}>
                              Action {actionIndex + 1}: {actionText || '(비어있음)'}
                            </span>
                            {isAlreadyInProject && (
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
                                이미 Project로 생성됨
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
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>"Show selected only" 필터를 해제하거나 항목을 선택해주세요.</p>
              </div>
            )}
          </div>

          {/* Right: Preview Panel */}
          <div
            style={{
              width: '350px',
              position: 'sticky',
              top: '1rem',
              maxHeight: 'calc(100vh - 2rem)',
              overflowY: 'auto',
              padding: '1rem',
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
            }}
          >
            <h2 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '500' }}>Selected Items</h2>
            {selectedActions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
                선택된 항목이 없습니다.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
                  {selectedActions.length} items selected
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                  {Array.from({ length: 8 }, (_, strategyIndex) => {
                    const strategyActions = selectedActions.filter((a) => a.strategy_index === strategyIndex)
                    if (strategyActions.length === 0) return null

                    return (
                      <div
                        key={strategyIndex}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                          Strategy {strategyIndex + 1}: {strategies[strategyIndex] || '(비어있음)'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {strategyActions.map((action) => (
                            <div
                              key={`${action.strategy_index}-${action.action_index}`}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem',
                                backgroundColor: 'white',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                              }}
                            >
                              <span style={{ flex: 1 }}>
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
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={handleNext}
                  disabled={selectedActions.length === 0 && manualItems.length === 0}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: selectedActions.length === 0 && manualItems.length === 0 ? '#e0e0e0' : '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: selectedActions.length === 0 && manualItems.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '500',
                  }}
                >
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Left: Project Title Input */}
          <div style={{ flex: '1', minWidth: 0 }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Confirm Selection</h2>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                Project Title
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

            {/* Selected Items Summary */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '500' }}>Selected Items ({selectedActions.length + manualItems.length})</h3>
              {Array.from({ length: 8 }, (_, strategyIndex) => {
                const strategyActions = selectedActions.filter((a) => a.strategy_index === strategyIndex)
                if (strategyActions.length === 0) return null

                return (
                  <div
                    key={strategyIndex}
                    style={{
                      marginBottom: '1rem',
                      padding: '1rem',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      backgroundColor: 'white',
                    }}
                  >
                    <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: '500' }}>
                      Strategy {strategyIndex + 1}: {strategies[strategyIndex] || '(비어있음)'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {strategyActions.map((action) => (
                        <div
                          key={`${action.strategy_index}-${action.action_index}`}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Action {action.action_index + 1}: {action.action_text || '(비어있음)'}</span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.5rem',
                                backgroundColor: '#0070f3',
                                color: 'white',
                                borderRadius: '4px',
                              }}
                            >
                              만다라트
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {/* Manual Items in Summary */}
              {manualItems.length > 0 && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    backgroundColor: 'white',
                  }}
                >
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    프로젝트 전용 업무
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {manualItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span>{item.title}</span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            borderRadius: '4px',
                          }}
                        >
                          직접 추가
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Manual Items Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '500' }}>프로젝트 전용 업무</h3>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={manualItemInput}
                  onChange={(e) => setManualItemInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddManualItem()
                    }
                  }}
                  placeholder="프로젝트에서 직접 할 일을 입력하세요"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  onClick={handleAddManualItem}
                  disabled={!manualItemInput.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: manualItemInput.trim() ? '#0070f3' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: manualItemInput.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                  }}
                >
                  추가
                </button>
              </div>
              {manualItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {manualItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem' }}>{item.title}</span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.5rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            borderRadius: '4px',
                          }}
                        >
                          직접 추가
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveManualItem(item.id)}
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
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleBack}
                disabled={creating}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'white',
                  color: '#333',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || (selectedActions.length === 0 && manualItems.length === 0) || !projectTitle.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: creating || (selectedActions.length === 0 && manualItems.length === 0) || !projectTitle.trim() ? '#e0e0e0' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: creating || (selectedActions.length === 0 && manualItems.length === 0) || !projectTitle.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step Navigation */}
      <StepNav
        prev={{
          href: '/mandarat',
          label: '← 이전 단계(만다라트)',
        }}
        next={{
          href: '/projects',
          label: '다음 단계(프로젝트) →',
        }}
      />
    </div>
  )
}

export default function ProjectsNewPage() {
  return (
    <RequireAuth>
      <ProjectsNewPageContent />
    </RequireAuth>
  )
}

