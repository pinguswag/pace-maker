/**
 * Entry route determination logic
 * Determines the correct entry route based on app state
 */

import { supabase } from './supabase/client'
import { loadProjects } from './projects'
import { loadMonthlyFocus } from './monthlyFocus'
import { loadWeeklyTasks } from './weeklyTasks'
import { getMonthKey, getWeekKey } from './keys'
import { ensureProfileExists } from './profiles'

export type EntryRoute = '/mandarat' | '/projects/new' | '/focus' | '/weekly' | '/today'

/**
 * Get the entry route based on app state
 * Returns the route the user should be redirected to
 */
export async function getEntryRoute(userId: string): Promise<EntryRoute> {
  try {
    // 0. Ensure profile exists (non-blocking, don't fail if this errors)
    try {
      await ensureProfileExists(userId)
    } catch (err) {
      console.warn('Failed to ensure profile in getEntryRoute (non-fatal):', err)
      // Continue anyway
    }

    // 1. Check Mandarat
    const { data: boardData, error: boardError } = await supabase
      .from('mandarat_boards')
      .select('id, yearly_goal')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (boardError) {
      console.error('Error checking mandarat:', boardError)
      return '/mandarat' // Safe fallback
    }

    // Board가 없거나 yearly_goal이 비어있으면 Mandarat으로
    if (!boardData || !boardData.yearly_goal?.trim()) {
      return '/mandarat'
    }

    // Strategies와 Actions 확인
    const { data: strategiesData } = await supabase
      .from('mandarat_strategies')
      .select('text_value')
      .eq('board_id', boardData.id)
      .limit(8)

    const { data: actionsData } = await supabase
      .from('mandarat_actions')
      .select('text_value')
      .eq('board_id', boardData.id)
      .limit(1)

    const hasMandaratData =
      (strategiesData && strategiesData.some((s) => s.text_value?.trim())) ||
      (actionsData && actionsData.some((a) => a.text_value?.trim()))

    if (!hasMandaratData) {
      return '/mandarat'
    }

    // 2. Check Projects (use Supabase)
    const { projects } = await loadProjects(userId)
    if (!projects || projects.length === 0) {
      return '/projects/new'
    }

    // 3. Check Monthly Focus (use Supabase)
    const currentMonthKey = getMonthKey(new Date())
    const { focus } = await loadMonthlyFocus(userId, currentMonthKey)
    if (!focus || focus.monthKey !== currentMonthKey || !focus.projectIds || focus.projectIds.length === 0) {
      return '/focus'
    }

    // 4. Check Weekly Tasks (use Supabase)
    const currentWeekKey = getWeekKey(new Date())
    const { tasks } = await loadWeeklyTasks(userId, currentWeekKey)
    if (!tasks || tasks.length === 0) {
      return '/weekly'
    }

    // 5. All conditions met -> /today
    return '/today'
  } catch (err) {
    console.error('Error determining entry route:', err)
    // Safe fallback to mandarat
    return '/mandarat'
  }
}
