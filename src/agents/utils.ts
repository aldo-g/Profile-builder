/**
 * Retries an async operation on Anthropic overloaded_error (529) with exponential backoff.
 * Other errors are re-thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 5000
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      if (isOverloadedError(err) && attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }
      throw err
    }
  }
  throw lastError
}

function isOverloadedError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    // Anthropic SDK APIError has a status property
    if (e.status === 529) return true
    // Also check message for overloaded_error string
    if (typeof e.message === 'string' && e.message.includes('overloaded_error')) return true
  }
  return false
}

/**
 * Extracts a human-readable message from an Anthropic API error.
 * The SDK sometimes puts raw JSON in err.message.
 */
export function friendlyErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Unknown error'
  const e = err as Record<string, unknown>

  // Anthropic SDK: status 529 = overloaded
  if (e.status === 529 || isOverloadedError(err)) {
    return 'The API is temporarily overloaded. Please try again in a few seconds.'
  }
  if (e.status === 401) return 'API key is invalid or missing.'
  if (e.status === 429) return 'Rate limit reached. Please wait a moment and try again.'

  // Try to parse message if it looks like JSON
  if (typeof e.message === 'string') {
    try {
      const parsed = JSON.parse(e.message)
      if (parsed?.error?.message) return parsed.error.message
      if (parsed?.message) return parsed.message
    } catch {
      // not JSON — use as-is
    }
    return e.message
  }

  return 'An unexpected error occurred.'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
