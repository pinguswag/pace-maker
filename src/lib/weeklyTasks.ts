/**
 * Weekly Tasks Supabase integration
 * Handles CRUD operations for weekly_tasks table
 */

import { supabase } from './supabase/client'
import { emitDataChanged } from './emitDataChanged'
import { getWeekKey } from './keys'
import { loadProjects, AppProject } from './projects'
import { debugLog, safeErrorSerialize } from './debugLog'
import { ensureProfileExists } from './profiles'

// Weekly Task type matching DB schema
export interface WeeklyTask {
  id: string
  user_id: string
  week_key: string
  project_id: string | null
  title: string
  status: 'todo' | 'done'
  order_index: number
  picked_for_today: boolean
  created_at: string
  updated_at: string
}

// App-level Weekly Task type
export interface AppWeeklyTask {
  id: string
  projectId: string | null
  title: string
  status: 'todo' | 'done'
  order: number
  created_at: string
  pickedDate?: string // "YYYY-MM-DD" - for compatibility, but DB uses picked_for_today boolean
}

/**
 * Convert DB Weekly Task to App Weekly Task
 */
function dbToAppTask(dbTask: WeeklyTask, todayDate?: string): AppWeeklyTask {
  return {
    id: dbTask.id,
    projectId: dbTask.project_id,
    title: dbTask.title,
    status: dbTask.status,
    order: dbTask.order_index,
    created_at: dbTask.created_at,
    // If picked_for_today is true, set pickedDate to today (for compatibility)
    pickedDate: dbTask.picked_for_today && todayDate ? todayDate : undefined,
  }
}

/**
 * Check if a string is a valid UUID
 */
function isUuid(v: string | null | undefined): boolean {
  if (!v || typeof v !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/**
 * Convert App Weekly Task to DB Weekly Task
 */
function appToDbTask(
  appTask: AppWeeklyTask,
  userId: string,
  weekKey: string,
  projectIdMapping?: Map<string, string | null>
): Omit<WeeklyTask, 'id' | 'created_at' | 'updated_at'> {
  let projectId: string | null = appTask.projectId

  // If projectId is already a UUID, use it directly
  if (isUuid(projectId)) {
    // UUID is valid, use as-is
  } else if (projectId && projectIdMapping) {
    // Map legacy projectId to Supabase UUID
    projectId = projectIdMapping.get(projectId) ?? null
  } else if (projectId && !isUuid(projectId)) {
    // Legacy projectId but no mapping available, set to null
    projectId = null
  }

  return {
    user_id: userId,
    week_key: weekKey,
    project_id: projectId,
    title: appTask.title,
    status: appTask.status,
    order_index: appTask.order,
    picked_for_today: !!appTask.pickedDate, // Convert pickedDate to boolean
  }
}

/**
 * Get weekly tasks from localStorage (fallback)
 */
function getLocalWeeklyTasks(weekKey: string): AppWeeklyTask[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('mock_weekly_plan_v1')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (parsed && parsed.weeks && parsed.weeks[weekKey] && Array.isArray(parsed.weeks[weekKey].tasks)) {
      return parsed.weeks[weekKey].tasks
    }
    return []
  } catch {
    return []
  }
}

/**
 * Get local projects from localStorage
 */
function getLocalProjects(): Array<{ id: string; title: string; source?: { items?: any[] } }> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('mock_projects_v1')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Create mapping from local project IDs to Supabase project UUIDs
 */
async function createProjectMapping(
  userId: string
): Promise<Map<string, string | null>> {
  const mapping = new Map<string, string | null>()

  try {
    // Load local projects
    const localProjects = getLocalProjects()
    
    // Load Supabase projects
    const { projects: supabaseProjects } = await loadProjects(userId)

    // Create mapping: localProjectId -> supabaseProjectUuid
    for (const localProject of localProjects) {
      if (!localProject.id || !localProject.title) continue

      // Strategy A: exact title match AND source_items length match
      let matched: AppProject | undefined = undefined
      
      for (const supabaseProject of supabaseProjects) {
        if (supabaseProject.title === localProject.title) {
          const localItemsCount = localProject.source?.items?.length || 0
          const supabaseItemsCount = supabaseProject.source?.items?.length || 0
          
          if (localItemsCount === supabaseItemsCount) {
            matched = supabaseProject
            break
          }
        }
      }

      // Strategy B: exact title match only (if Strategy A didn't match)
      if (!matched) {
        matched = supabaseProjects.find((p) => p.title === localProject.title)
      }

      // Strategy C: fallback to null (no match)
      mapping.set(localProject.id, matched?.id ?? null)
    }

    console.log(`Created project mapping: ${mapping.size} local projects mapped`)
  } catch (err) {
    console.error('Failed to create project mapping:', err)
    // Return empty mapping - all legacy IDs will map to null
  }

  return mapping
}

/**
 * Migrate local weekly tasks to Supabase
 */
async function migrateLocalTasksToSupabase(
  localTasks: AppWeeklyTask[],
  userId: string,
  weekKey: string
): Promise<void> {
  if (localTasks.length === 0) return

  // Ensure profile exists before migration
  await ensureProfileExists(userId)

  // Create project ID mapping (legacy local IDs -> Supabase UUIDs)
  const projectMapping = await createProjectMapping(userId)

  // Convert to DB format - let Supabase generate new UUIDs for all tasks
  // This ensures data integrity and avoids ID conflicts
  const dbTasks: Array<Omit<WeeklyTask, 'id' | 'created_at' | 'updated_at'>> = []
  const skippedTasks: Array<{ reason: string; task: AppWeeklyTask }> = []

  for (const task of localTasks) {
    // Validate title
    if (!task.title || !task.title.trim()) {
      skippedTasks.push({ reason: 'empty title', task })
      continue
    }

    // Convert to DB format with project mapping
    const dbTask = appToDbTask(task, userId, weekKey, projectMapping)

    // Final validation: ensure project_id is either null or a valid UUID
    if (dbTask.project_id !== null && !isUuid(dbTask.project_id)) {
      console.warn(`Invalid project_id for task "${task.title}": ${dbTask.project_id}, setting to null`)
      dbTask.project_id = null
    }

    dbTasks.push(dbTask)
  }

  if (dbTasks.length === 0) {
    console.warn('No valid tasks to migrate')
    if (skippedTasks.length > 0) {
      console.warn(`Skipped ${skippedTasks.length} tasks:`, skippedTasks)
    }
    return
  }

  try {
    console.log(`Attempting to migrate ${dbTasks.length} tasks to Supabase for weekKey: ${weekKey}`)
    if (skippedTasks.length > 0) {
      console.warn(`Skipped ${skippedTasks.length} invalid tasks`)
    }

    // Dedupe: check for existing tasks with same (week_key, title, project_id)
    const { data: existingTasks } = await supabase
      .from('weekly_tasks')
      .select('title, project_id')
      .eq('user_id', userId)
      .eq('week_key', weekKey)

    const existingKeys = new Set(
      (existingTasks || []).map((t) => `${t.title.toLowerCase().trim()}:${t.project_id || 'null'}`)
    )

    // Filter out duplicates
    const uniqueTasks = dbTasks.filter((task) => {
      const key = `${task.title.toLowerCase().trim()}:${task.project_id || 'null'}`
      return !existingKeys.has(key)
    })

    if (uniqueTasks.length < dbTasks.length) {
      console.log(`Deduplicated ${dbTasks.length - uniqueTasks.length} tasks during migration`)
    }

    if (uniqueTasks.length === 0) {
      console.log('All tasks already exist in Supabase, skipping migration')
      return
    }

    // Batch insert all valid, unique tasks
    const { data, error, status } = await supabase
      .from('weekly_tasks')
      .insert(uniqueTasks)
      .select()

    debugLog('migrateWeeklyTasks:insert', { weekKey, count: uniqueTasks.length }, { error, data, status })

    if (error) {
      const errorInfo = safeErrorSerialize(error)
      console.error('Migration insert error:', errorInfo)
      
      // Don't crash UI - log error and return
      // The fallback to localStorage will handle this
      throw new Error(`Migration failed: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
    }

    if (!data || data.length === 0) {
      throw new Error('Migration insert returned no data')
    }

    console.log(`Successfully migrated ${data.length} tasks to Supabase`)
    if (skippedTasks.length > 0) {
      console.warn(`Note: ${skippedTasks.length} tasks were skipped during migration`)
    }
  } catch (err: any) {
    // Log error but don't crash - let the fallback mechanism handle it
    const errorMessage = err?.message || 'Unknown migration error'
    const errorCode = err?.code || 'UNKNOWN'
    console.error('Migration failed (non-fatal):', {
      errorMessage,
      errorCode,
      tasksAttempted: dbTasks.length,
      tasksSkipped: skippedTasks.length,
    })
    // Re-throw to trigger fallback
    throw err
  }
}

/**
 * Load weekly tasks from Supabase
 * Falls back to localStorage if Supabase fails
 */
export async function loadWeeklyTasks(
  userId: string,
  weekKey: string,
  todayDate?: string
): Promise<{
  tasks: AppWeeklyTask[]
  fromSupabase: boolean
  error?: string
}> {
  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('weekly_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('week_key', weekKey)
      .order('project_id', { ascending: true, nullsFirst: false }) // nulls last
      .order('order_index', { ascending: true })

    if (error) throw error

    // If Supabase returns no rows, check localStorage for migration
    // Idempotency: only migrate if DB has no tasks for this week_key
    if (!data || data.length === 0) {
      const migratedKey = `mock_weekly_tasks_migrated_v1_${weekKey}`
      const migrated = localStorage.getItem(migratedKey)
      if (migrated !== 'true') {
        // Try to migrate from localStorage
        const localTasks = getLocalWeeklyTasks(weekKey)
        if (localTasks.length > 0) {
          try {
            await migrateLocalTasksToSupabase(localTasks, userId, weekKey)
            localStorage.setItem(migratedKey, 'true')
            // Reload from Supabase after migration
            const { data: migratedData, error: reloadError } = await supabase
              .from('weekly_tasks')
              .select('*')
              .eq('user_id', userId)
              .eq('week_key', weekKey)
              .order('project_id', { ascending: true, nullsFirst: false })
              .order('order_index', { ascending: true })

            if (reloadError) throw reloadError

            return {
              tasks: (migratedData || []).map((t) => dbToAppTask(t, todayDate)),
              fromSupabase: true,
            }
          } catch (migrateError: any) {
            const errorInfo = safeErrorSerialize(migrateError)
            console.error('Migration failed:', errorInfo)
            // Fall through to localStorage fallback
          }
        }
      }
      return {
        tasks: [],
        fromSupabase: true,
      }
    }

    return {
      tasks: data.map((t) => dbToAppTask(t, todayDate)),
      fromSupabase: true,
    }
  } catch (error: any) {
    const errorInfo = safeErrorSerialize(error)
    console.error('Failed to load weekly tasks from Supabase:', errorInfo)
    debugLog('loadWeeklyTasks:error', { userId, weekKey }, { error })
    // Fallback to localStorage
    const localTasks = getLocalWeeklyTasks(weekKey)
    return {
      tasks: localTasks,
      fromSupabase: false,
      error: errorInfo.message || 'Failed to load from Supabase',
    }
  }
}

/**
 * Create a new weekly task
 */
export async function createWeeklyTask(
  weekKey: string,
  projectId: string | null,
  title: string,
  userId: string,
  orderIndex?: number
): Promise<AppWeeklyTask> {
  try {
    // If orderIndex not provided, get max order_index + 1
    let finalOrderIndex = orderIndex
    if (finalOrderIndex === undefined) {
      const { data: existingTasks } = await supabase
        .from('weekly_tasks')
        .select('order_index')
        .eq('user_id', userId)
        .eq('week_key', weekKey)
        .order('order_index', { ascending: false })
        .limit(1)

      finalOrderIndex = existingTasks && existingTasks.length > 0 ? existingTasks[0].order_index + 1 : 0
    }

    const { data, error } = await supabase
      .from('weekly_tasks')
      .insert({
        user_id: userId,
        week_key: weekKey,
        project_id: projectId,
        title: title.trim(),
        status: 'todo',
        order_index: finalOrderIndex,
        picked_for_today: false,
      })
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('No data returned from insert')

    emitDataChanged()
    return dbToAppTask(data)
  } catch (error: any) {
    console.error('Failed to create weekly task:', error)
    throw error
  }
}

/**
 * Update a weekly task
 */
export async function updateWeeklyTask(
  id: string,
  patch: Partial<{
    title: string
    status: 'todo' | 'done'
    order_index: number
    picked_for_today: boolean
    project_id: string | null
  }>
): Promise<AppWeeklyTask> {
  try {
    // Validate project_id if provided
    const validatedPatch = { ...patch }
    if ('project_id' in patch && patch.project_id !== null && !isUuid(patch.project_id)) {
      console.warn(`Invalid project_id in update: ${patch.project_id}, setting to null`)
      validatedPatch.project_id = null
    }

    const { data, error, status } = await supabase
      .from('weekly_tasks')
      .update(validatedPatch)
      .eq('id', id)
      .select()
      .single()

    debugLog('updateWeeklyTask', { id, patch: Object.keys(validatedPatch) }, { error, data, status })

    if (error) {
      const errorInfo = safeErrorSerialize(error)
      throw new Error(`Failed to update weekly task: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
    }
    if (!data) throw new Error('No data returned from update')

    emitDataChanged()
    return dbToAppTask(data)
  } catch (error: any) {
    console.error('Failed to update weekly task:', error)
    throw error
  }
}

/**
 * Delete a weekly task
 */
export async function deleteWeeklyTask(id: string): Promise<void> {
  try {
    const { error, status } = await supabase.from('weekly_tasks').delete().eq('id', id)

    debugLog('deleteWeeklyTask', { id }, { error, status })

    if (error) {
      const errorInfo = safeErrorSerialize(error)
      throw new Error(`Failed to delete weekly task: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
    }

    emitDataChanged()
  } catch (error: any) {
    console.error('Failed to delete weekly task:', error)
    throw error
  }
}

/**
 * Bulk reorder weekly tasks (minimize writes)
 * Updates order_index for multiple tasks
 */
export async function bulkReorderWeeklyTasks(
  updates: Array<{ id: string; order_index: number }>
): Promise<void> {
  if (updates.length === 0) return

  try {
    // Use a transaction-like approach: update each task
    // Supabase doesn't support true transactions in JS client, so we do sequential updates
    // For better performance, we could batch if Supabase supports it
    const promises = updates.map((update) =>
      supabase
        .from('weekly_tasks')
        .update({ order_index: update.order_index })
        .eq('id', update.id)
    )

    const results = await Promise.all(promises)
    const errors = results.filter((r) => r.error).map((r) => r.error)

    if (errors.length > 0) {
      throw new Error(`Failed to update ${errors.length} tasks: ${errors[0]?.message}`)
    }

    emitDataChanged()
  } catch (error: any) {
    console.error('Failed to bulk reorder weekly tasks:', error)
    throw error
  }
}

/**
 * Migrate from localStorage if needed (one-time per weekKey)
 * This is called explicitly if needed, but loadWeeklyTasks already handles it
 */
export async function migrateFromLocalStorageIfNeeded(
  userId: string,
  weekKey: string
): Promise<void> {
  const migratedKey = `mock_weekly_tasks_migrated_v1_${weekKey}`
  const migrated = localStorage.getItem(migratedKey)
  if (migrated === 'true') return

  // Check if DB has any tasks for this weekKey
  const { data, error } = await supabase
    .from('weekly_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('week_key', weekKey)
    .limit(1)

  if (error) throw error

  // If DB has 0 rows, try migration
  if (!data || data.length === 0) {
    const localTasks = getLocalWeeklyTasks(weekKey)
    if (localTasks.length > 0) {
      await migrateLocalTasksToSupabase(localTasks, userId, weekKey)
      localStorage.setItem(migratedKey, 'true')
    }
  }
}
