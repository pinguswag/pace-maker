/**
 * Debug logger utility
 * Enabled when NEXT_PUBLIC_DEBUG=true
 */

const DEBUG_ENABLED = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG === 'true'

export function debugLog(
  operation: string,
  payload?: any,
  response?: { error?: any; data?: any; status?: number }
) {
  if (!DEBUG_ENABLED) return

  const logEntry: any = {
    operation,
    timestamp: new Date().toISOString(),
  }

  if (payload !== undefined) {
    // Sanitize payload - remove sensitive data
    const sanitized = sanitizePayload(payload)
    logEntry.payload = sanitized
  }

  if (response) {
    if (response.error) {
      logEntry.error = {
        message: response.error.message,
        code: response.error.code,
        details: response.error.details,
        hint: response.error.hint,
        status: response.status,
      }
    } else {
      logEntry.success = {
        dataCount: Array.isArray(response.data) ? response.data.length : response.data ? 1 : 0,
        status: response.status,
      }
    }
  }

  console.log('[DEBUG]', JSON.stringify(logEntry, null, 2))
}

function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload

  const sanitized: any = Array.isArray(payload) ? [] : {}
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth']

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

export function safeErrorSerialize(error: any): {
  message: string
  code?: string
  details?: any
  hint?: string
  stack?: string
  errorType?: string
  rawError?: any
  allProperties?: string[]
} {
  // Handle null/undefined
  if (error == null) {
    return {
      message: 'Unknown error (null/undefined)',
      errorType: 'null',
    }
  }

  const result: any = {
    errorType: typeof error,
  }

  // Get all property names (including non-enumerable)
  let allProps: string[] = []
  try {
    allProps = Object.getOwnPropertyNames(error)
    result.allProperties = allProps
  } catch {
    // Ignore
  }

  // Handle Error instances
  if (error instanceof Error) {
    result.errorType = error.constructor?.name || 'Error'
    result.message = error.message || 'Unknown error'
    if (error.stack) result.stack = error.stack

    // Try to extract Supabase-specific fields
    const anyError = error as any
    if (anyError.code !== undefined) result.code = anyError.code
    if (anyError.details !== undefined) result.details = anyError.details
    if (anyError.hint !== undefined) result.hint = anyError.hint
    if (anyError.status !== undefined) result.status = anyError.status
    if (anyError.statusCode !== undefined) result.statusCode = anyError.statusCode

    // Try to get all properties
    for (const prop of allProps) {
      if (!['message', 'stack', 'name'].includes(prop)) {
        try {
          result[prop] = (error as any)[prop]
        } catch {
          // Ignore
        }
      }
    }

    return result
  }

  // Handle plain objects
  if (typeof error === 'object') {
    result.errorType = error.constructor?.name || 'object'

    // Try common error property names
    const commonProps = ['message', 'msg', 'error', 'err', 'code', 'details', 'hint', 'status', 'statusCode']
    for (const prop of commonProps) {
      if (prop in error) {
        try {
          result[prop] = (error as any)[prop]
        } catch {
          // Ignore
        }
      }
    }

    // Try to get message from any property
    if (!result.message) {
      for (const prop of ['message', 'msg', 'error', 'err', 'description', 'desc']) {
        if (prop in error && (error as any)[prop]) {
          result.message = String((error as any)[prop])
          break
        }
      }
    }

    // If still no message, try JSON.stringify with all properties
    if (!result.message || result.message === '[object Object]') {
      try {
        // Use a replacer function to handle circular references
        const seen = new WeakSet()
        const stringified = JSON.stringify(
          error,
          (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) {
                return '[Circular]'
              }
              seen.add(value)
            }
            return value
          },
          2
        )
        result.message = `Error object: ${stringified.substring(0, 500)}`
      } catch (stringifyError) {
        result.message = `Error object (could not stringify: ${stringifyError})`
        // Try to get at least some info
        result.allProperties = allProps
        result.propertyCount = allProps.length
      }
    }

    // Include all properties if message is still empty
    if (!result.message || result.message === '[object Object]') {
      result.message = `Error object with ${allProps.length} properties: ${allProps.join(', ')}`
    }

    return result
  }

  // Handle primitives
  return {
    message: String(error),
    errorType: typeof error,
  }
}
