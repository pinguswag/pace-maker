/**
 * Profiles helper
 * Ensures a profiles row exists for the current user
 */

import { supabase } from './supabase/client'
import { debugLog, safeErrorSerialize } from './debugLog'

/**
 * Ensure a profiles row exists for the current user
 * This must be called before any insert/upsert into projects/monthly_focus/weekly_tasks
 */
// Cache to prevent multiple simultaneous calls
const profileCheckCache = new Map<string, Promise<void>>()

export async function ensureProfileExists(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required')
  }

  // Check cache to prevent duplicate calls
  if (profileCheckCache.has(userId)) {
    return profileCheckCache.get(userId)!
  }

  const promise = (async () => {
    try {
      // Check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (fetchError) {
        debugLog('ensureProfileExists:fetch', { userId }, { error: fetchError })
        // If table doesn't exist, skip (for backward compatibility)
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          console.warn('Profiles table does not exist, skipping profile creation')
          return
        }
        throw fetchError
      }

      // If profile exists, return early
      if (existingProfile) {
        return
      }

      // Create profile if it doesn't exist
      const { data, error, status } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          mandarat_completed: false,
        })
        .select()
        .single()

      debugLog('ensureProfileExists:insert', { userId }, { error, data, status })

      if (error) {
        // If it's a unique constraint violation, profile was created by another request
        if (error.code === '23505') {
          console.log('Profile already exists (race condition)')
          return
        }

        const errorInfo = safeErrorSerialize(error)
        throw new Error(`Failed to create profile: ${errorInfo.message} (${errorInfo.code || 'UNKNOWN'})`)
      }

      if (!data) {
        throw new Error('No data returned from profile insert')
      }

      console.log('Profile created successfully for user:', userId)
    } catch (err: any) {
      const errorInfo = safeErrorSerialize(err)
      console.error('Failed to ensure profile exists:', errorInfo)
      throw err
    } finally {
      // Clear cache after 5 seconds to allow retry if needed
      setTimeout(() => {
        profileCheckCache.delete(userId)
      }, 5000)
    }
  })()

  profileCheckCache.set(userId, promise)
  return promise
}
