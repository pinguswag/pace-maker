/**
 * Monthly Focus Supabase integration
 * Handles CRUD operations for monthly_focus table
 */

import { supabase } from './supabase/client'
import { emitDataChanged } from './emitDataChanged'
import { getMonthKey } from './keys'
import { debugLog, safeErrorSerialize } from './debugLog'
import { ensureProfileExists } from './profiles'

/**
 * Check if a string is a valid UUID
 */
function isUuid(v: string | null | undefined): boolean {
  if (!v || typeof v !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

// Monthly Focus type matching DB schema
export interface MonthlyFocus {
  id: string
  user_id: string
  month_key: string
  project_ids: string[]
  created_at: string
  updated_at: string
}

// App-level Monthly Focus type
export interface AppMonthlyFocus {
  monthKey: string
  projectIds: string[]
}

/**
 * Convert DB Monthly Focus to App Monthly Focus
 */
function dbToAppFocus(dbFocus: MonthlyFocus): AppMonthlyFocus {
  return {
    monthKey: dbFocus.month_key,
    projectIds: dbFocus.project_ids || [],
  }
}

/**
 * Get monthly focus from localStorage (fallback)
 */
function getLocalMonthlyFocus(monthKey: string): AppMonthlyFocus | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('mock_monthly_focus_v1')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.monthKey === monthKey && Array.isArray(parsed.projectIds)) {
      return {
        monthKey: parsed.monthKey,
        projectIds: parsed.projectIds,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Migrate local monthly focus to Supabase
 * Filters invalid project IDs (non-UUIDs)
 */
async function migrateLocalFocusToSupabase(
  localFocus: AppMonthlyFocus,
  userId: string
): Promise<void> {
  // Ensure profile exists before migration
  await ensureProfileExists(userId)

  // Filter out invalid project IDs (non-UUIDs)
  const validProjectIds = (localFocus.projectIds || []).filter((id) => isUuid(id))
  const invalidCount = localFocus.projectIds.length - validProjectIds.length

  if (invalidCount > 0) {
    console.warn(`Filtered out ${invalidCount} invalid project IDs during migration`)
  }

  const { data, error, status } = await supabase
    .from('monthly_focus')
    .upsert(
      {
        user_id: userId,
        month_key: localFocus.monthKey,
        project_ids: validProjectIds,
      },
      {
        onConflict: 'user_id,month_key',
      }
    )
    .select()

  debugLog('migrateMonthlyFocus', { monthKey: localFocus.monthKey, projectCount: validProjectIds.length }, { error, data, status })

  if (error) {
    const errorInfo = safeErrorSerialize(error)
    throw new Error(`Migration failed: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
  }
}

/**
 * Load monthly focus from Supabase
 * Falls back to localStorage if Supabase fails
 */
export async function loadMonthlyFocus(
  userId: string,
  monthKey: string
): Promise<{
  focus: AppMonthlyFocus | null
  fromSupabase: boolean
  error?: string
}> {
  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('monthly_focus')
      .select('*')
      .eq('user_id', userId)
      .eq('month_key', monthKey)
      .maybeSingle()

    if (error) throw error

    // If Supabase returns no row, check localStorage for migration
    if (!data) {
      const migrated = localStorage.getItem('mock_monthly_focus_migrated_v1')
      if (migrated !== 'true') {
        // Try to migrate from localStorage
        const localFocus = getLocalMonthlyFocus(monthKey)
        if (localFocus) {
          try {
            await migrateLocalFocusToSupabase(localFocus, userId)
            localStorage.setItem('mock_monthly_focus_migrated_v1', 'true')
            // Reload from Supabase after migration
            const { data: migratedData, error: reloadError } = await supabase
              .from('monthly_focus')
              .select('*')
              .eq('user_id', userId)
              .eq('month_key', monthKey)
              .maybeSingle()

            if (reloadError) throw reloadError

            return {
              focus: migratedData ? dbToAppFocus(migratedData) : null,
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
        focus: null,
        fromSupabase: true,
      }
    }

    return {
      focus: dbToAppFocus(data),
      fromSupabase: true,
    }
  } catch (error: any) {
    const errorInfo = safeErrorSerialize(error)
    console.error('Failed to load monthly focus from Supabase:', errorInfo)
    debugLog('loadMonthlyFocus:error', { userId, monthKey }, { error })
    // Fallback to localStorage
    const localFocus = getLocalMonthlyFocus(monthKey)
    return {
      focus: localFocus,
      fromSupabase: false,
      error: errorInfo.message || 'Failed to load from Supabase',
    }
  }
}

/**
 * Save monthly focus (UPSERT)
 * Filters out invalid project IDs before saving
 */
export async function saveMonthlyFocus(
  monthKey: string,
  projectIds: string[],
  userId: string,
  validProjectIds?: string[] // Optional: pre-filtered valid IDs
): Promise<AppMonthlyFocus> {
  try {
    // Filter out invalid project IDs if validProjectIds provided
    let filteredProjectIds = projectIds
    if (validProjectIds && validProjectIds.length > 0) {
      filteredProjectIds = projectIds.filter((id) => validProjectIds.includes(id))
    }

    // Enforce max 3 (DB constraint will also enforce this)
    if (filteredProjectIds.length > 3) {
      filteredProjectIds = filteredProjectIds.slice(0, 3)
    }

    // Final validation: ensure all project IDs are UUIDs
    const validatedProjectIds = filteredProjectIds.filter((id) => isUuid(id))
    if (validatedProjectIds.length !== filteredProjectIds.length) {
      console.warn(`Filtered out ${filteredProjectIds.length - validatedProjectIds.length} invalid project IDs`)
    }

    // UPSERT into Supabase
    const { data, error, status } = await supabase
      .from('monthly_focus')
      .upsert(
        {
          user_id: userId,
          month_key: monthKey,
          project_ids: validatedProjectIds, // Empty array is allowed (0 selected)
        },
        {
          onConflict: 'user_id,month_key',
        }
      )
      .select()
      .single()

    debugLog('saveMonthlyFocus', { monthKey, projectCount: validatedProjectIds.length }, { error, data, status })

    if (error) {
      const errorInfo = safeErrorSerialize(error)
      throw new Error(`Failed to save monthly focus: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
    }
    if (!data) throw new Error('No data returned from upsert')

    emitDataChanged()
    return dbToAppFocus(data)
  } catch (error: any) {
    console.error('Failed to save monthly focus:', error)
    throw error
  }
}
