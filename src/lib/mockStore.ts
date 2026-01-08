'use client'

import { emitDataChanged } from './emitDataChanged'
import { getMonthKey } from './keys'

// 공용 타입 정의 (필요 최소한)
export interface MonthlyFocus {
  monthKey: string
  projectIds: string[]
}

export interface WeeklyTask {
  id: string
  projectId: string | null
  title: string
  status: 'todo' | 'done'
  order: number
  created_at: string
  pickedDate?: string
}

export interface WeeklyPlan {
  weeks: Record<string, { tasks: WeeklyTask[] }>
}

export interface Routine {
  id: string
  title: string
  cadence: 'daily' | 'weekly'
  days?: number[]
  active: boolean
  created_at: string
}

export interface RoutinesData {
  routines: Routine[]
}

type RoutineCompletion = Record<string, Record<string, boolean>>

function safeParse<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function setItem(key: string, value: any) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
  emitDataChanged()
}

// Projects
export function getProjects<T = any[]>(): T {
  return safeParse<T>('mock_projects_v1', [] as unknown as T)
}

export function setProjects(projects: any[]) {
  setItem('mock_projects_v1', projects)
}

// Monthly Focus
export function getMonthlyFocus(): MonthlyFocus {
  const fallback: MonthlyFocus = { monthKey: getMonthKey(new Date()), projectIds: [] }
  const parsed = safeParse<MonthlyFocus>('mock_monthly_focus_v1', fallback)
  if (!parsed || !parsed.monthKey || !Array.isArray(parsed.projectIds)) return fallback
  return parsed
}

export function setMonthlyFocus(focus: MonthlyFocus) {
  setItem('mock_monthly_focus_v1', focus)
}

// Weekly Plan
export function getWeeklyPlan(): WeeklyPlan {
  const fallback: WeeklyPlan = { weeks: {} }
  const parsed = safeParse<WeeklyPlan>('mock_weekly_plan_v1', fallback)
  if (!parsed || typeof parsed !== 'object' || !parsed.weeks) return fallback
  return { weeks: parsed.weeks || {} }
}

export function setWeeklyPlan(plan: WeeklyPlan) {
  setItem('mock_weekly_plan_v1', plan)
}

// Routines
export function getRoutines(): RoutinesData {
  const fallback: RoutinesData = { routines: [] }
  const parsed = safeParse<RoutinesData>('mock_routines_v1', fallback)
  if (!parsed || !Array.isArray(parsed.routines)) return fallback
  return parsed
}

export function setRoutines(data: RoutinesData) {
  setItem('mock_routines_v1', data)
}

// Routine Completion
export function getRoutineCompletion(): RoutineCompletion {
  return safeParse<RoutineCompletion>('mock_routine_completion_v1', {})
}

export function setRoutineCompletion(data: RoutineCompletion) {
  setItem('mock_routine_completion_v1', data)
}
