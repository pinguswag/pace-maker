/**
 * Projects Supabase integration
 * Handles CRUD operations for projects table
 */

import { supabase } from './supabase/client'
import { emitDataChanged } from './emitDataChanged'
import { debugLog, safeErrorSerialize } from './debugLog'
import { ensureProfileExists } from './profiles'

// Project type matching DB schema
export interface Project {
  id: string
  user_id: string
  name?: string // Legacy column (may exist in DB)
  title: string
  status: string
  source_items: Array<{
    strategy_index: number
    action_index: number
    strategy_text: string
    action_text: string
  }>
  created_at: string
  updated_at: string
}

// App-level Project type (with source structure)
export interface AppProject {
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
  // Legacy format compatibility
  source_strategy_index?: number
  source_action_index?: number
}

/**
 * Convert DB Project to App Project
 */
function dbToAppProject(dbProject: Project): AppProject {
  return {
    id: dbProject.id,
    title: dbProject.title,
    status: dbProject.status as 'draft',
    created_at: dbProject.created_at,
    source: {
      yearlyGoal: '', // Not stored in DB, empty for now
      items: dbProject.source_items || [],
    },
  }
}

/**
 * Convert App Project to DB Project
 */
function appToDbProject(appProject: Partial<AppProject>, userId: string): Partial<Project> {
  // Extract only the fields we need for source_items
  const sourceItems = (appProject.source?.items || []).map((item) => ({
    strategy_index: item.strategy_index,
    action_index: item.action_index,
    strategy_text: item.strategy_text,
    action_text: item.action_text,
  }))

  const projectTitle = appProject.title?.trim() || ''
  if (!projectTitle) {
    throw new Error('Project title is required')
  }

  return {
    name: projectTitle, // Fill name column (required by DB schema)
    title: projectTitle,
    status: appProject.status || 'draft',
    source_items: sourceItems,
  }
}

/**
 * Load projects from Supabase
 * Falls back to localStorage if Supabase fails
 */
export async function loadProjects(userId: string): Promise<{
  projects: AppProject[]
  fromSupabase: boolean
  error?: string
}> {
  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // If Supabase returns 0 rows, check localStorage for migration
    if (!data || data.length === 0) {
      const migrated = localStorage.getItem('mock_projects_migrated_v1')
      if (migrated !== 'true') {
        // Try to migrate from localStorage
        const localProjects = getLocalProjects()
        if (localProjects.length > 0) {
          try {
            await migrateLocalProjectsToSupabase(localProjects, userId)
            localStorage.setItem('mock_projects_migrated_v1', 'true')
            // Reload from Supabase after migration
            const { data: migratedData, error: reloadError } = await supabase
              .from('projects')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })

            if (reloadError) throw reloadError

            return {
              projects: (migratedData || []).map(dbToAppProject),
              fromSupabase: true,
            }
          } catch (migrateError: any) {
            const errorInfo = safeErrorSerialize(migrateError)
            console.error('=== Projects Migration Error (fallback) ===')
            console.error('Error info:', errorInfo)
            console.error('Raw error:', migrateError)
            console.error('Error type:', typeof migrateError)
            console.error('==========================================')
            
            // If migration failed due to profiles, don't retry on next load
            if (errorInfo.code === '23503' || errorInfo.message?.includes('profiles') || errorInfo.message?.includes('foreign key')) {
              localStorage.setItem('mock_projects_migration_failed_v1', 'true')
            }
            
            // Fall through to localStorage fallback
          }
        }
      }
    }

    return {
      projects: (data || []).map(dbToAppProject),
      fromSupabase: true,
    }
  } catch (error: any) {
    const errorInfo = safeErrorSerialize(error)
    console.error('Failed to load projects from Supabase:', errorInfo)
    debugLog('loadProjects:error', { userId }, { error })
    // Fallback to localStorage
    const localProjects = getLocalProjects()
    return {
      projects: localProjects,
      fromSupabase: false,
      error: errorInfo.message || 'Failed to load from Supabase',
    }
  }
}

/**
 * Get projects from localStorage (fallback)
 */
function getLocalProjects(): AppProject[] {
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
 * Migrate local projects to Supabase
 * Idempotent: checks for existing projects by title + source_items hash
 */
async function migrateLocalProjectsToSupabase(
  localProjects: AppProject[],
  userId: string
): Promise<void> {
  if (localProjects.length === 0) return

  // Check if migration has permanently failed
  const migrationFailed = localStorage.getItem('mock_projects_migration_failed_v1')
  if (migrationFailed === 'true') {
    console.warn('Projects migration previously failed, skipping to avoid spam')
    return
  }

  // Ensure profile exists before migration
  try {
    await ensureProfileExists(userId)
  } catch (err: any) {
    const errorInfo = safeErrorSerialize(err)
    // If it's a profiles-related error, mark migration as failed
    if (errorInfo.code === '23503' || errorInfo.message?.includes('profiles')) {
      console.error('Profile does not exist, marking migration as failed:', errorInfo)
      localStorage.setItem('mock_projects_migration_failed_v1', 'true')
      throw new Error('Profile does not exist. Please refresh the page and try again.')
    }
    // For other errors, still throw but don't mark as permanently failed
    throw err
  }

  // Check existing projects to avoid duplicates
  const { data: existingProjects, error: fetchError } = await supabase
    .from('projects')
    .select('title, source_items')
    .eq('user_id', userId)

  if (fetchError) {
    debugLog('migrateProjects:fetchExisting', { userId }, { error: fetchError })
    throw fetchError
  }

  // Create a set of existing project keys (title + source_items hash)
  const existingKeys = new Set(
    (existingProjects || []).map((p) => {
      const itemsHash = JSON.stringify(p.source_items || []).slice(0, 50) // Simple hash
      return `${p.title}:${itemsHash}`
    })
  )

  // Filter out duplicates
  const projectsToInsert = localProjects
    .map((project) => {
      const itemsHash = JSON.stringify(project.source?.items || []).slice(0, 50)
      const key = `${project.title}:${itemsHash}`
      if (existingKeys.has(key)) {
        return null // Skip duplicate
      }
      existingKeys.add(key) // Mark as processed
      
      // Validate title is not empty
      const projectTitle = project.title?.trim()
      if (!projectTitle) {
        console.warn('Skipping project with empty title:', project)
        return null
      }
      
      return {
        user_id: userId,
        name: projectTitle, // Fill name column (required by DB schema)
        title: projectTitle,
        status: project.status || 'draft',
        source_items: project.source?.items || [],
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  if (projectsToInsert.length === 0) {
    console.log('All projects already exist in Supabase, skipping migration')
    return
  }

  const { data, error, status } = await supabase
    .from('projects')
    .insert(projectsToInsert)
    .select()

  debugLog('migrateProjects:insert', { count: projectsToInsert.length }, { error, data, status })

  if (error) {
    const errorInfo = safeErrorSerialize(error)
    console.error('=== Projects Migration Failed ===')
    console.error('Error info:', errorInfo)
    console.error('Raw error:', error)
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)
    if (error && typeof error === 'object') {
      console.error('Error keys:', Object.keys(error))
      // Try to access common Supabase error properties
      console.error('Error.message:', (error as any).message)
      console.error('Error.code:', (error as any).code)
      console.error('Error.details:', (error as any).details)
      console.error('Error.hint:', (error as any).hint)
    }
    console.error('================================')
    
    // If it's a foreign key constraint violation (profiles missing), mark as failed
    if (errorInfo.code === '23503' || errorInfo.message?.includes('profiles') || errorInfo.message?.includes('foreign key')) {
      console.error('Foreign key constraint violation - profile may be missing')
      localStorage.setItem('mock_projects_migration_failed_v1', 'true')
      throw new Error('Profile does not exist. Please refresh the page and try again.')
    }
    
    // Create a more informative error
    const errorMessage = errorInfo.message || 'Unknown migration error'
    const errorCode = errorInfo.code || 'UNKNOWN'
    throw new Error(`Projects migration failed: ${errorMessage} (code: ${errorCode})`)
  }

  console.log(`Migrated ${data?.length || 0} projects to Supabase`)
}

/**
 * Create a new project
 */
export async function createProject(
  project: Partial<AppProject>,
  userId: string
): Promise<AppProject> {
  try {
    const dbProject = appToDbProject(project, userId)
    const { data, error, status } = await supabase
      .from('projects')
      .insert([{ ...dbProject, user_id: userId }])
      .select()
      .single()

    debugLog('createProject', { title: dbProject.title }, { error, data, status })

    if (error) {
      const errorInfo = safeErrorSerialize(error)
      throw new Error(`Failed to create project: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
    }
    if (!data) throw new Error('No data returned from insert')

    emitDataChanged()
    return dbToAppProject(data)
  } catch (error: any) {
    console.error('Failed to create project:', error)
    throw error
  }
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<AppProject>,
  userId: string
): Promise<AppProject> {
  try {
    const dbProject = appToDbProject(updates, userId)
    const { data, error, status } = await supabase
      .from('projects')
      .update(dbProject)
      .eq('id', projectId)
      .eq('user_id', userId)
      .select()
      .single()

    debugLog('updateProject', { projectId, updates: Object.keys(updates) }, { error, data, status })

    if (error) {
      const errorInfo = safeErrorSerialize(error)
      throw new Error(`Failed to update project: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
    }
    if (!data) throw new Error('No data returned from update')

    emitDataChanged()
    return dbToAppProject(data)
  } catch (error: any) {
    console.error('Failed to update project:', error)
    throw error
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string, userId: string): Promise<void> {
  try {
    const { error, status } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId)

    debugLog('deleteProject', { projectId }, { error, status })

    if (error) {
      const errorInfo = safeErrorSerialize(error)
      throw new Error(`Failed to delete project: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
    }

    emitDataChanged()
  } catch (error: any) {
    console.error('Failed to delete project:', error)
    throw error
  }
}
