'use client'

import { getMonthKey } from './keys'
/**
 * localStorage mock 데이터 검증 및 복구 유틸리티
 */

interface ValidationResult {
  repaired: boolean
  notes: string[]
}

/**
 * localStorage mock 데이터 검증 및 복구
 */
export function validateAndRepairMockData(): ValidationResult {
  const notes: string[] = []
  let repaired = false

  if (typeof window === 'undefined') {
    return { repaired: false, notes: ['Server-side: validation skipped'] }
  }

  try {
    // 1. Projects 검증
    let projectsData: any[] = []
    try {
      const stored = localStorage.getItem('mock_projects_v1')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          projectsData = parsed
        } else {
          notes.push('Projects: invalid format, resetting to []')
          localStorage.setItem('mock_projects_v1', JSON.stringify([]))
          repaired = true
        }
      } else {
        localStorage.setItem('mock_projects_v1', JSON.stringify([]))
        notes.push('Projects: missing, initialized to []')
        repaired = true
      }
    } catch (err) {
      notes.push(`Projects: parse error, resetting to []`)
      localStorage.setItem('mock_projects_v1', JSON.stringify([]))
      repaired = true
    }

    // 프로젝트 항목 검증 및 복구
    const validProjectIds = new Set<string>()
    projectsData = projectsData.map((project) => {
      if (!project.id || !project.title) {
        notes.push(`Project: missing id/title, skipping`)
        return null
      }
      validProjectIds.add(project.id)

      // source.items 검증
      if (project.source && project.source.items) {
        if (!Array.isArray(project.source.items)) {
          project.source.items = []
          notes.push(`Project ${project.id}: invalid items array, resetting`)
          repaired = true
        } else {
          project.source.items = project.source.items.filter((item: any) => {
            if (!item.id || !item.title || !item.source) {
              notes.push(`Project ${project.id}: invalid item, removing`)
              repaired = true
              return false
            }
            if (item.source !== 'mandarat' && item.source !== 'manual') {
              notes.push(`Project ${project.id}: invalid item source, removing`)
              repaired = true
              return false
            }
            if (item.source === 'mandarat' && (item.strategy_index === undefined || item.action_index === undefined)) {
              notes.push(`Project ${project.id}: mandarat item missing indices, removing`)
              repaired = true
              return false
            }
            return true
          })
        }
      } else if (project.source) {
        project.source.items = []
        notes.push(`Project ${project.id}: missing items array, initializing`)
        repaired = true
      }

      return project
    }).filter(Boolean)

      if (repaired) {
        localStorage.setItem('mock_projects_v1', JSON.stringify(projectsData))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app:data-changed'))
        }
      }

    // 2. Monthly Focus 검증
    const currentMonthKey = getMonthKey(new Date())
    try {
      const stored = localStorage.getItem('mock_monthly_focus_v1')
      let focusData: any = null
      
      if (stored) {
        try {
          focusData = JSON.parse(stored)
        } catch (e) {
          focusData = null
        }
      }

      if (!focusData || typeof focusData !== 'object' || !focusData.monthKey || !Array.isArray(focusData.projectIds)) {
        focusData = { monthKey: currentMonthKey, projectIds: [] }
        notes.push('Monthly Focus: invalid format, resetting')
        repaired = true
      } else if (focusData.monthKey !== currentMonthKey) {
        // 월이 변경되었으면 초기화
        focusData = { monthKey: currentMonthKey, projectIds: [] }
        notes.push('Monthly Focus: month changed, resetting')
        repaired = true
      } else {
        // 존재하지 않는 프로젝트 ID 제거
        const originalLength = focusData.projectIds.length
        focusData.projectIds = focusData.projectIds.filter((id: string) => validProjectIds.has(id))
        if (focusData.projectIds.length !== originalLength) {
          notes.push('Monthly Focus: removed invalid project IDs')
          repaired = true
        }
      }

      if (repaired) {
        localStorage.setItem('mock_monthly_focus_v1', JSON.stringify(focusData))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app:data-changed'))
        }
      }
    } catch (err) {
      notes.push('Monthly Focus: error, resetting')
      localStorage.setItem('mock_monthly_focus_v1', JSON.stringify({ monthKey: currentMonthKey, projectIds: [] }))
      repaired = true
    }

    // 3. Weekly Plan 검증
    try {
      const stored = localStorage.getItem('mock_weekly_plan_v1')
      let weeklyPlan: any = { weeks: {} }
      
      if (stored) {
        try {
          weeklyPlan = JSON.parse(stored)
          if (!weeklyPlan.weeks || typeof weeklyPlan.weeks !== 'object') {
            weeklyPlan = { weeks: {} }
            notes.push('Weekly Plan: invalid format, resetting weeks')
            repaired = true
          }
        } catch (e) {
          weeklyPlan = { weeks: {} }
          notes.push('Weekly Plan: parse error, resetting')
          repaired = true
        }
      } else {
        localStorage.setItem('mock_weekly_plan_v1', JSON.stringify(weeklyPlan))
        notes.push('Weekly Plan: missing, initialized')
        repaired = true
      }

      // 각 주의 작업 검증 및 정규화
      for (const weekKey in weeklyPlan.weeks) {
        const weekData = weeklyPlan.weeks[weekKey]
        if (!weekData || !Array.isArray(weekData.tasks)) {
          weeklyPlan.weeks[weekKey] = { tasks: [] }
          notes.push(`Weekly Plan ${weekKey}: invalid tasks, resetting`)
          repaired = true
          continue
        }

        // 작업 검증 및 order 정규화
        const tasksByProject: Record<string, any[]> = {}
        const nullProjectTasks: any[] = []
        
        weekData.tasks = weekData.tasks.filter((task: any) => {
          if (!task.id || !task.title || task.status === undefined || task.order === undefined) {
            notes.push(`Weekly Plan ${weekKey}: invalid task, removing`)
            repaired = true
            return false
          }
          
          // projectId가 없거나 삭제된 프로젝트인 경우 null로 설정
          if (!task.projectId || !validProjectIds.has(task.projectId)) {
            task.projectId = null
            nullProjectTasks.push(task)
            notes.push(`Weekly Plan ${weekKey}: task ${task.id} has invalid projectId, set to null`)
            repaired = true
          }
          
          if (task.status !== 'todo' && task.status !== 'done') {
            notes.push(`Weekly Plan ${weekKey}: invalid task status, fixing`)
            task.status = 'todo'
            repaired = true
          }
          
          const projectKey = task.projectId ?? 'null'
          if (!tasksByProject[projectKey]) {
            tasksByProject[projectKey] = []
          }
          tasksByProject[projectKey].push(task)
          return true
        })

        // 프로젝트별 order 정규화 (0부터 시작)
        for (const projectKey in tasksByProject) {
          tasksByProject[projectKey].sort((a, b) => a.order - b.order)
          tasksByProject[projectKey].forEach((task, index) => {
            if (task.order !== index) {
              task.order = index
              repaired = true
            }
          })
        }

        weekData.tasks = Object.values(tasksByProject).flat()
      }

      if (repaired) {
        localStorage.setItem('mock_weekly_plan_v1', JSON.stringify(weeklyPlan))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app:data-changed'))
        }
      }
    } catch (err) {
      notes.push('Weekly Plan: error, resetting')
      localStorage.setItem('mock_weekly_plan_v1', JSON.stringify({ weeks: {} }))
      repaired = true
    }

    // 4. Routines 검증
    try {
      const stored = localStorage.getItem('mock_routines_v1')
      let routinesData: any = { routines: [] }
      
      if (stored) {
        try {
          routinesData = JSON.parse(stored)
          if (!routinesData.routines || !Array.isArray(routinesData.routines)) {
            routinesData = { routines: [] }
            notes.push('Routines: invalid format, resetting')
            repaired = true
          }
        } catch (e) {
          routinesData = { routines: [] }
          notes.push('Routines: parse error, resetting')
          repaired = true
        }
      } else {
        localStorage.setItem('mock_routines_v1', JSON.stringify(routinesData))
        notes.push('Routines: missing, initialized')
        repaired = true
      }

      // 루틴 검증
      const validRoutineIds = new Set<string>()
      routinesData.routines = routinesData.routines.filter((routine: any) => {
        if (!routine.id || !routine.title || !routine.cadence) {
          notes.push('Routine: missing required fields, removing')
          repaired = true
          return false
        }
        if (routine.cadence !== 'daily' && routine.cadence !== 'weekly') {
          notes.push(`Routine ${routine.id}: invalid cadence, removing`)
          repaired = true
          return false
        }
        if (routine.cadence === 'weekly') {
          if (!Array.isArray(routine.days)) {
            routine.days = []
            notes.push(`Routine ${routine.id}: invalid days, resetting`)
            repaired = true
          } else {
            routine.days = routine.days.filter((day: any) => {
              if (typeof day !== 'number' || day < 0 || day > 6) {
                notes.push(`Routine ${routine.id}: invalid day, removing`)
                repaired = true
                return false
              }
              return true
            })
          }
        }
        if (typeof routine.active !== 'boolean') {
          routine.active = true
          notes.push(`Routine ${routine.id}: invalid active, defaulting to true`)
          repaired = true
        }
        validRoutineIds.add(routine.id)
        return true
      })

      if (repaired) {
        localStorage.setItem('mock_routines_v1', JSON.stringify(routinesData))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('app:data-changed'))
        }
      }

      // 5. Routine Completion 검증 (존재하는 루틴만 유지)
      try {
        const stored = localStorage.getItem('mock_routine_completion_v1')
        let completionData: any = {}
        
        if (stored) {
          try {
            completionData = JSON.parse(stored)
            if (typeof completionData !== 'object' || completionData === null) {
              completionData = {}
              notes.push('Routine Completion: invalid format, resetting')
              repaired = true
            }
          } catch (e) {
            completionData = {}
            notes.push('Routine Completion: parse error, resetting')
            repaired = true
          }
        } else {
          localStorage.setItem('mock_routine_completion_v1', JSON.stringify(completionData))
          notes.push('Routine Completion: missing, initialized')
          repaired = true
        }

        // 존재하지 않는 루틴의 완료 기록 제거
        for (const date in completionData) {
          if (typeof completionData[date] !== 'object' || completionData[date] === null) {
            delete completionData[date]
            notes.push(`Routine Completion ${date}: invalid format, removing`)
            repaired = true
            continue
          }
          for (const routineId in completionData[date]) {
            if (!validRoutineIds.has(routineId)) {
              delete completionData[date][routineId]
              notes.push(`Routine Completion ${date}: removed invalid routine ${routineId}`)
              repaired = true
            } else if (typeof completionData[date][routineId] !== 'boolean') {
              delete completionData[date][routineId]
              notes.push(`Routine Completion ${date}: invalid boolean for ${routineId}, removing`)
              repaired = true
            }
          }
          // 빈 날짜 객체 제거
          if (Object.keys(completionData[date]).length === 0) {
            delete completionData[date]
          }
        }

        if (repaired) {
          localStorage.setItem('mock_routine_completion_v1', JSON.stringify(completionData))
        }
      } catch (err) {
        notes.push('Routine Completion: error, resetting')
        localStorage.setItem('mock_routine_completion_v1', JSON.stringify({}))
        repaired = true
      }
    } catch (err) {
      notes.push('Routines: error, resetting')
      localStorage.setItem('mock_routines_v1', JSON.stringify({ routines: [] }))
      repaired = true
    }

  } catch (err) {
    notes.push(`Validation error: ${err}`)
  }

  return { repaired, notes }
}
