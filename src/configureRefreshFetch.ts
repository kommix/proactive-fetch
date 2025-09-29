import type { RefreshConfiguration, EnhancedFetchFunction } from './types'

/**
 * Configures a fetch function with automatic token refresh capabilities.
 *
 * This function wraps your existing fetch implementation to automatically handle
 * token refresh when requests fail due to expired authentication.
 *
 * @param configuration - Configuration object containing refresh logic
 * @returns Enhanced fetch function with token refresh capabilities
 */
function configureRefreshFetch (configuration: RefreshConfiguration): EnhancedFetchFunction {
  const { refreshToken, shouldRefreshToken, fetch } = configuration

  let refreshingTokenPromise: Promise<void> | null = null

  return async (url: string | Request | URL, options: RequestInit = {}): Promise<unknown> => {
    // If a refresh is already in progress, wait for it to complete
    if (refreshingTokenPromise !== null) {
      try {
        await refreshingTokenPromise
        return await fetch(url, options)
      } catch {
        // Even if the refreshing fails, attempt the fetch so we reject with
        // the error of the actual request rather than the refresh error
        return await fetch(url, options)
      }
    }

    try {
      return await fetch(url, options)
    } catch (error: unknown) {
      // Check if this error should trigger a token refresh
      if (shouldRefreshToken(error)) {
        // Start refresh if not already in progress
        if (refreshingTokenPromise === null) {
          refreshingTokenPromise = new Promise<void>((resolve, reject) => {
            refreshToken()
              .then(() => {
                refreshingTokenPromise = null
                resolve()
              })
              .catch((refreshTokenError: Error) => {
                refreshingTokenPromise = null
                reject(refreshTokenError)
              })
          })
        }

        try {
          await refreshingTokenPromise
          // Retry the original request with the refreshed token
          return await fetch(url, options)
        } catch {
          // If refreshing fails, continue with the original error
          throw error
        }
      } else {
        // This error doesn't warrant a token refresh, re-throw it
        throw error
      }
    }
  }
}

export default configureRefreshFetch
