'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { useAuth } from '@/components/auth/AuthProvider'

interface MandaratBoard {
  id: string
  user_id: string
  yearly_goal: string
}

interface MandaratStrategy {
  id: string
  board_id: string
  strategy_index: number
  text_value: string
}

interface MandaratAction {
  id: string
  board_id: string
  strategy_index: number
  action_index: number
  text_value: string
}

// 차트 셀 타입
type ChartCellType = 'yearly-goal' | 'strategy' | 'action' | 'empty'

interface ChartCell {
  row: number
  col: number
  type: ChartCellType
  strategyIndex?: number // strategy 타입일 때
  actionIndex?: number // action 타입일 때
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

function MandaratPageContent() {
  const { session } = useAuth()
  const [board, setBoard] = useState<MandaratBoard | null>(null)
  const [yearlyGoal, setYearlyGoal] = useState('')
  const [strategies, setStrategies] = useState<string[]>(Array(8).fill(''))
  const [actions, setActions] = useState<string[][]>(Array(8).fill(null).map(() => Array(8).fill('')))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number; value: string; cell: ChartCell } | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [timeoutError, setTimeoutError] = useState(false)
  const initializedRef = useRef(false)

  // 차트 셀 매핑 생성 (9x9)
  const getChartCell = (row: number, col: number): ChartCell => {
    // 중앙 셀 (4,4)
    if (row === 4 && col === 4) {
      return { row, col, type: 'yearly-goal' }
    }

    // 중앙 3x3 블록의 회색 셀들 (전략 목표)
    if (row >= 3 && row <= 5 && col >= 3 && col <= 5 && !(row === 4 && col === 4)) {
      // 시계방향 매핑: (3,3)=0, (3,4)=1, (3,5)=2, (4,5)=3, (5,5)=4, (5,4)=5, (5,3)=6, (4,3)=7
      let strategyIndex = -1
      if (row === 3 && col === 3) strategyIndex = 0
      else if (row === 3 && col === 4) strategyIndex = 1
      else if (row === 3 && col === 5) strategyIndex = 2
      else if (row === 4 && col === 5) strategyIndex = 3
      else if (row === 5 && col === 5) strategyIndex = 4
      else if (row === 5 && col === 4) strategyIndex = 5
      else if (row === 5 && col === 3) strategyIndex = 6
      else if (row === 4 && col === 3) strategyIndex = 7

      return { row, col, type: 'strategy', strategyIndex }
    }

    // 외곽 블록들
    const blockRow = Math.floor(row / 3)
    const blockCol = Math.floor(col / 3)
    const localRow = row % 3
    const localCol = col % 3

    // 외곽 블록 중앙 셀들 (전략 목표 반영)
    if (localRow === 1 && localCol === 1) {
      // 각 블록의 중앙 셀을 전략 인덱스로 매핑
      let strategyIndex = -1
      if (blockRow === 0 && blockCol === 0) strategyIndex = 0 // (1,1)
      else if (blockRow === 0 && blockCol === 1) strategyIndex = 1 // (1,4)
      else if (blockRow === 0 && blockCol === 2) strategyIndex = 2 // (1,7)
      else if (blockRow === 1 && blockCol === 2) strategyIndex = 3 // (4,7)
      else if (blockRow === 2 && blockCol === 2) strategyIndex = 4 // (7,7)
      else if (blockRow === 2 && blockCol === 1) strategyIndex = 5 // (7,4)
      else if (blockRow === 2 && blockCol === 0) strategyIndex = 6 // (7,1)
      else if (blockRow === 1 && blockCol === 0) strategyIndex = 7 // (4,1)

      if (strategyIndex >= 0) {
        return { row, col, type: 'strategy', strategyIndex }
      }
    }

    // 외곽 블록의 나머지 8개 셀 (액션 아이디어)
    // 각 블록의 중앙 셀을 제외한 8개 셀을 시계방향으로 매핑
    if (!(localRow === 1 && localCol === 1)) {
      let strategyIndex = -1
      let actionIndex = -1

      // 블록 위치에 따른 전략 인덱스 결정
      if (blockRow === 0 && blockCol === 0) strategyIndex = 0
      else if (blockRow === 0 && blockCol === 1) strategyIndex = 1
      else if (blockRow === 0 && blockCol === 2) strategyIndex = 2
      else if (blockRow === 1 && blockCol === 2) strategyIndex = 3
      else if (blockRow === 2 && blockCol === 2) strategyIndex = 4
      else if (blockRow === 2 && blockCol === 1) strategyIndex = 5
      else if (blockRow === 2 && blockCol === 0) strategyIndex = 6
      else if (blockRow === 1 && blockCol === 0) strategyIndex = 7

      if (strategyIndex >= 0) {
        // 시계방향 매핑: (0,0)=0, (0,1)=1, (0,2)=2, (1,2)=3, (2,2)=4, (2,1)=5, (2,0)=6, (1,0)=7
        if (localRow === 0 && localCol === 0) actionIndex = 0
        else if (localRow === 0 && localCol === 1) actionIndex = 1
        else if (localRow === 0 && localCol === 2) actionIndex = 2
        else if (localRow === 1 && localCol === 2) actionIndex = 3
        else if (localRow === 2 && localCol === 2) actionIndex = 4
        else if (localRow === 2 && localCol === 1) actionIndex = 5
        else if (localRow === 2 && localCol === 0) actionIndex = 6
        else if (localRow === 1 && localCol === 0) actionIndex = 7

        if (actionIndex >= 0) {
          return { row, col, type: 'action', strategyIndex, actionIndex }
        }
      }
    }

    return { row, col, type: 'empty' }
  }

  // 차트 셀 내용 가져오기
  const getChartCellContent = (cell: ChartCell): string => {
    if (cell.type === 'yearly-goal') return yearlyGoal
    if (cell.type === 'strategy' && cell.strategyIndex !== undefined) {
      return strategies[cell.strategyIndex] || ''
    }
    if (cell.type === 'action' && cell.strategyIndex !== undefined && cell.actionIndex !== undefined) {
      return actions[cell.strategyIndex]?.[cell.actionIndex] || ''
    }
    return ''
  }

  // 차트 셀 테두리 스타일 계산
  const getCellBorderStyle = (row: number, col: number): React.CSSProperties => {
    const style: React.CSSProperties = {}
    
    // 기본 테두리
    const defaultBorder = '1px solid #ccc'
    
    // 외곽 테두리 (두꺼운 선)
    if (row === 0) style.borderTop = '2px solid #333'
    if (row === 8) style.borderBottom = '2px solid #333'
    if (col === 0) style.borderLeft = '2px solid #333'
    if (col === 8) style.borderRight = '2px solid #333'
    
    // 3x3 블록 경계선 (두꺼운 선)
    // 행 경계: row 2와 5 다음 (즉, row 3과 6의 위쪽)
    if (row === 3 || row === 6) style.borderTop = '2px solid #333'
    // 열 경계: col 2와 5 다음 (즉, col 3과 6의 왼쪽)
    if (col === 3 || col === 6) style.borderLeft = '2px solid #333'
    
    // 나머지 테두리는 기본 (이미 두꺼운 선이 설정되지 않은 경우만)
    if (!style.borderTop && row > 0) style.borderTop = defaultBorder
    if (!style.borderBottom && row < 8) style.borderBottom = defaultBorder
    if (!style.borderLeft && col > 0) style.borderLeft = defaultBorder
    if (!style.borderRight && col < 8) style.borderRight = defaultBorder
    
    return style
  }

  // 초기 데이터 로딩
  useEffect(() => {
    if (!session?.user?.id || initializedRef.current) return

    initializedRef.current = true

    const loadData = async () => {
      const timeoutId = setTimeout(() => {
        setTimeoutError(true)
        setLoading(false)
        setError('로딩 시간이 초과되었습니다. 다시 시도해주세요.')
      }, 8000)

      try {
        setLoading(true)
        setError(null)
        setSetupRequired(false)
        setTimeoutError(false)

        const userId = session.user.id

        // 1. 사용자의 board 찾기 또는 생성 (upsert 사용)
        let { data: boardData, error: boardError } = await supabase
          .from('mandarat_boards')
          .select('*')
          .eq('user_id', userId)
          .limit(1)
          .single()

        if (isTableMissingError(boardError)) {
          clearTimeout(timeoutId)
          setSetupRequired(true)
          setLoading(false)
          return
        }

        // 보드가 없으면 upsert로 생성 (이미 있으면 업데이트하지 않음)
        if (boardError && boardError.code === 'PGRST116') {
          const { data: upsertedBoard, error: upsertError } = await supabase
            .from('mandarat_boards')
            .upsert(
              { user_id: userId, yearly_goal: '' },
              {
                onConflict: 'user_id',
                ignoreDuplicates: false,
              }
            )
            .select()
            .single()

          if (isTableMissingError(upsertError)) {
            clearTimeout(timeoutId)
            setSetupRequired(true)
            setLoading(false)
            return
          }

          if (upsertError) {
            // 중복 키 에러인 경우 다시 조회 시도
            if (
              upsertError.message?.includes('duplicate key') ||
              upsertError.message?.includes('unique constraint') ||
              upsertError.code === '23505'
            ) {
              const { data: existingBoard, error: retryError } = await supabase
                .from('mandarat_boards')
                .select('*')
                .eq('user_id', userId)
                .limit(1)
                .single()

              if (retryError) {
                clearTimeout(timeoutId)
                setError(retryError.message)
                setLoading(false)
                return
              }

              boardData = existingBoard
            } else {
              clearTimeout(timeoutId)
              setError(upsertError.message)
              setLoading(false)
              return
            }
          } else {
            boardData = upsertedBoard
          }
        } else if (boardError) {
          clearTimeout(timeoutId)
          setError(boardError.message)
          setLoading(false)
          return
        }

        if (!boardData) {
          clearTimeout(timeoutId)
          setError('보드를 불러올 수 없습니다.')
          setLoading(false)
          return
        }

        setBoard(boardData)
        setYearlyGoal(boardData.yearly_goal || '')

        // 2. 전략 데이터 로드
        const { data: strategiesData, error: strategiesError } = await supabase
          .from('mandarat_strategies')
          .select('*')
          .eq('board_id', boardData.id)
          .order('strategy_index', { ascending: true })

        if (isTableMissingError(strategiesError)) {
          clearTimeout(timeoutId)
          setSetupRequired(true)
          setLoading(false)
          return
        }

        if (strategiesError) {
          clearTimeout(timeoutId)
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

        // 누락된 전략 생성
        const missingStrategies = []
        for (let i = 0; i < 8; i++) {
          if (!strategiesData?.find((s) => s.strategy_index === i)) {
            missingStrategies.push({
              board_id: boardData.id,
              strategy_index: i,
              text_value: '',
            })
          }
        }

        if (missingStrategies.length > 0) {
          const { error: insertError } = await supabase
            .from('mandarat_strategies')
            .insert(missingStrategies)

          if (isTableMissingError(insertError)) {
            clearTimeout(timeoutId)
            setSetupRequired(true)
            setLoading(false)
            return
          }

          if (insertError) {
            clearTimeout(timeoutId)
            setError(insertError.message)
            setLoading(false)
            return
          }
        }

        setStrategies(strategiesArray)

        // 3. 액션 데이터 로드
        const { data: actionsData, error: actionsError } = await supabase
          .from('mandarat_actions')
          .select('*')
          .eq('board_id', boardData.id)
          .order('strategy_index', { ascending: true })
          .order('action_index', { ascending: true })

        if (isTableMissingError(actionsError)) {
          clearTimeout(timeoutId)
          setSetupRequired(true)
          setLoading(false)
          return
        }

        if (actionsError) {
          clearTimeout(timeoutId)
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

        // 누락된 액션 생성
        const missingActions = []
        for (let s = 0; s < 8; s++) {
          for (let a = 0; a < 8; a++) {
            if (!actionsData?.find((act) => act.strategy_index === s && act.action_index === a)) {
              missingActions.push({
                board_id: boardData.id,
                strategy_index: s,
                action_index: a,
                text_value: '',
              })
            }
          }
        }

        if (missingActions.length > 0) {
          const { error: insertError } = await supabase.from('mandarat_actions').insert(missingActions)

          if (isTableMissingError(insertError)) {
            clearTimeout(timeoutId)
            setSetupRequired(true)
            setLoading(false)
            return
          }

          if (insertError) {
            clearTimeout(timeoutId)
            setError(insertError.message)
            setLoading(false)
            return
          }
        }

        setActions(actionsArray)
        clearTimeout(timeoutId)
      } catch (err) {
        clearTimeout(timeoutId)
        setError('데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()

    return () => {
      initializedRef.current = false
    }
  }, [session?.user?.id])

  // 저장
  const handleSave = async () => {
    if (!board || !session?.user?.id) return

    try {
      setSaving(true)
      setError(null)
      setSavedMessage(false)

      // 1. Board 업데이트
      const { error: boardError } = await supabase
        .from('mandarat_boards')
        .update({ yearly_goal: yearlyGoal })
        .eq('id', board.id)

      if (boardError) {
        setError(boardError.message)
        setSaving(false)
        return
      }

      // 2. 전략 upsert
      const strategiesData = strategies.map((text, index) => ({
        board_id: board.id,
        strategy_index: index,
        text_value: text,
      }))

      const { error: strategiesError } = await supabase
        .from('mandarat_strategies')
        .upsert(strategiesData, {
          onConflict: 'board_id,strategy_index',
        })

      if (strategiesError) {
        setError(strategiesError.message)
        setSaving(false)
        return
      }

      // 3. 액션 upsert
      const actionsData: Array<{
        board_id: string
        strategy_index: number
        action_index: number
        text_value: string
      }> = []

      for (let s = 0; s < 8; s++) {
        for (let a = 0; a < 8; a++) {
          actionsData.push({
            board_id: board.id,
            strategy_index: s,
            action_index: a,
            text_value: actions[s][a] || '',
          })
        }
      }

      const { error: actionsError } = await supabase
        .from('mandarat_actions')
        .upsert(actionsData, {
          onConflict: 'board_id,strategy_index,action_index',
        })

      if (actionsError) {
        setError(actionsError.message)
        setSaving(false)
        return
      }

      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 2000)
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 재시도
  const handleRetry = () => {
    initializedRef.current = false
    setError(null)
    setTimeoutError(false)
    setSetupRequired(false)
    setLoading(true)
    // useEffect가 다시 실행되도록 강제
    if (session?.user?.id) {
      const userId = session.user.id
      // 상태 업데이트로 재트리거
      setTimeout(() => {
        initializedRef.current = false
      }, 100)
    }
  }

  // 전략 업데이트
  const updateStrategy = (index: number, value: string) => {
    const newStrategies = [...strategies]
    newStrategies[index] = value
    setStrategies(newStrategies)
  }

  // 액션 업데이트
  const updateAction = (strategyIndex: number, actionIndex: number, value: string) => {
    const newActions = actions.map((row) => [...row])
    newActions[strategyIndex][actionIndex] = value
    setActions(newActions)
  }

  // 셀 클릭 핸들러 (셀 내부 편집 모드)
  const handleCellClick = (cell: ChartCell) => {
    if (cell.type === 'empty') return
    
    const content = getChartCellContent(cell)
    setEditingCell({ row: cell.row, col: cell.col, value: content, cell })
    setSelectedCell({ row: cell.row, col: cell.col })
  }

  // 셀 편집 저장
  const handleCellSave = (newValue: string) => {
    if (!editingCell) return

    const { cell } = editingCell
    const trimmedValue = newValue.trim()

    if (cell.type === 'yearly-goal') {
      setYearlyGoal(trimmedValue)
    } else if (cell.type === 'strategy' && cell.strategyIndex !== undefined) {
      updateStrategy(cell.strategyIndex, trimmedValue)
    } else if (cell.type === 'action' && cell.strategyIndex !== undefined && cell.actionIndex !== undefined) {
      updateAction(cell.strategyIndex, cell.actionIndex, trimmedValue)
    }

    setEditingCell(null)
    setSelectedCell(null)
  }

  // 셀 편집 취소
  const handleCellCancel = () => {
    setEditingCell(null)
    setSelectedCell(null)
  }

  // Setup Required 화면
  if (setupRequired) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>Mandarat</h1>
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
            Mandarat 기능을 사용하려면 데이터베이스 테이블을 생성해야 합니다.
          </p>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: '500' }}>설정 방법:</h3>
            <ol style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
              <li>Supabase 대시보드에서 SQL Editor를 엽니다</li>
              <li>
                다음 파일의 내용을 복사합니다: <code style={{ backgroundColor: '#f5f5f5', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>supabase/mandarat_v2_schema.sql</code>
              </li>
              <li>SQL Editor에 붙여넣고 실행합니다</li>
              <li>이 페이지를 새로고침하거나 아래 버튼을 클릭하세요</li>
            </ol>
          </div>
          <button
            onClick={handleRetry}
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
            다시 시도
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
      <h1 style={{ marginBottom: '2rem' }}>Mandarat</h1>

      {/* 9x9 Chart */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Chart</h2>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#666' }}>
            <span>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#ffeb3b', marginRight: '0.5rem', verticalAlign: 'middle', border: '1px solid #ccc' }}></span>
              Center = Yearly Goal
            </span>
            <span>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', backgroundColor: '#e0e0e0', marginRight: '0.5rem', verticalAlign: 'middle', border: '1px solid #ccc' }}></span>
              Grey = Strategy
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gap: '0',
            border: '2px solid #333',
            width: 'fit-content',
            margin: '0 auto',
          }}
        >
          {Array.from({ length: 9 }, (_, row) =>
            Array.from({ length: 9 }, (_, col) => {
              const cell = getChartCell(row, col)
              const content = getChartCellContent(cell)
              const isSelected = selectedCell?.row === row && selectedCell?.col === col

              // 스타일 결정
              let backgroundColor = '#fff'
              let fontWeight: 'normal' | 'bold' = 'normal'
              let hoverColor = '#d0d0d0'

              if (cell.type === 'yearly-goal') {
                backgroundColor = '#ffeb3b' // 노란색
                hoverColor = '#fff176' // 연한 노란색
                fontWeight = 'bold'
              } else if (cell.type === 'strategy') {
                backgroundColor = '#e0e0e0' // 회색 (모든 전략 셀 통일)
                hoverColor = '#d0d0d0' // 호버 시 약간 어두운 회색
                fontWeight = 'bold' // '500' 대신 'bold' 사용
              } else if (cell.type === 'action') {
                backgroundColor = '#f5f5f5' // 연한 회색
                hoverColor = '#e8e8e8' // 호버 시 약간 어두운 연한 회색
              }

              const borderStyle = getCellBorderStyle(row, col)
              const finalStyle: React.CSSProperties = {
                width: '80px',
                height: '80px',
                padding: '0.5rem',
                backgroundColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight,
                cursor: 'pointer',
                overflow: 'hidden',
                lineHeight: '1.2',
                maxHeight: '80px',
                transition: 'background-color 0.2s',
                ...borderStyle,
              }

              // 선택된 셀일 때 모든 테두리를 파란색으로 변경 (개별 속성 사용)
              if (isSelected) {
                finalStyle.borderTop = '2px solid #0070f3'
                finalStyle.borderBottom = '2px solid #0070f3'
                finalStyle.borderLeft = '2px solid #0070f3'
                finalStyle.borderRight = '2px solid #0070f3'
              }

              const isEditing = editingCell?.row === row && editingCell?.col === col

              return (
                <div
                  key={`${row}-${col}`}
                  onClick={() => !isEditing && handleCellClick(cell)}
                  style={finalStyle}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isEditing) {
                      e.currentTarget.style.backgroundColor = hoverColor
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isEditing) {
                      e.currentTarget.style.backgroundColor = backgroundColor
                    }
                  }}
                  title={content && content.trim() ? content : undefined}
                >
                  {isEditing ? (
                    <textarea
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellSave(editingCell.value)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || e.key === 'Escape') {
                          e.preventDefault()
                          if (e.key === 'Escape') {
                            handleCellCancel()
                          } else {
                            handleCellSave(editingCell.value)
                          }
                        }
                        // Enter alone allows newline (default behavior)
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontSize: '0.75rem',
                        fontWeight,
                        textAlign: 'center',
                        padding: '0',
                        margin: '0',
                        fontFamily: 'inherit',
                        resize: 'none',
                        overflow: 'auto',
                      }}
                    />
                  ) : (
                    <div
                      title={content && content.trim() ? content : undefined}
                      style={{
                        textAlign: 'center',
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'pre-wrap',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        fontSize: '0.75rem',
                        fontWeight,
                        lineHeight: '1.2',
                      }}
                    >
                      {content || ''}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>


      {/* Error Message */}
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
          {timeoutError && (
            <button
              onClick={handleRetry}
              style={{
                marginLeft: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {/* Saved Message */}
      {savedMessage && (
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

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: saving ? '#e0e0e0' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: '1rem',
          fontWeight: '500',
        }}
      >
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}

export default function MandaratPage() {
  return (
    <RequireAuth>
      <MandaratPageContent />
    </RequireAuth>
  )
}
