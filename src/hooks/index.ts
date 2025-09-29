/**
 * React hooks for proactive-fetch integration
 *
 * Provides React hooks for easy integration with React and React Native
 * applications, including environment detection, network state, and
 * token management.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { detectEnvironment } from '../environment'
import type { Environment, RefreshConfiguration, EnhancedFetchFunction } from '../types'
import {
  appStateManager,
  networkManager,
  type AppState,
  type NetworkState
} from '../platforms/react-native'
import configureRefreshFetch from '../configureRefreshFetch'

/**
 * Hook for environment detection
 *
 * @returns Current environment information
 */
export function useEnvironment (): Environment {
  const [environment, setEnvironment] = useState<Environment>(() => detectEnvironment())

  useEffect(() => {
    // Re-detect environment on mount (useful for SSR)
    setEnvironment(detectEnvironment())
  }, [])

  return environment
}

/**
 * Hook for React Native app state monitoring
 *
 * @returns Current app state and utilities
 */
export function useAppState (): {
  appState: AppState
  isInForeground: boolean
  isInBackground: boolean
} {
  const [appState, setAppState] = useState<AppState>(() =>
    appStateManager.getCurrentState()
  )

  useEffect(() => {
    const unsubscribe = appStateManager.addListener(setAppState)
    return unsubscribe
  }, [])

  return {
    appState,
    isInForeground: appState === 'active',
    isInBackground: appState === 'background'
  }
}

/**
 * Hook for network state monitoring
 *
 * @returns Current network state and utilities
 */
export function useNetworkState (): NetworkState & {
  isOnline: boolean
  isCellular: boolean
  isWiFi: boolean
} {
  const [networkState, setNetworkState] = useState<NetworkState>(() =>
    networkManager.getCurrentState()
  )

  useEffect(() => {
    const unsubscribe = networkManager.addListener(setNetworkState)
    return unsubscribe
  }, [])

  return {
    ...networkState,
    isOnline: networkManager.isOnline(),
    isCellular: networkManager.isCellular(),
    isWiFi: networkManager.isWiFi()
  }
}

/**
 * Hook for creating and managing a fetch instance with token refresh
 *
 * @param configuration - Token refresh configuration
 * @returns Enhanced fetch function and utilities
 */
export function useRefreshFetch (
  configuration: RefreshConfiguration
): {
    fetch: EnhancedFetchFunction
    isRefreshing: boolean
    lastRefreshTime: number | null
    refreshCount: number
  } {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  const refreshingRef = useRef(false)

  // Wrap the original refresh function to track state
  const enhancedRefreshToken = useCallback(async () => {
    if (refreshingRef.current) {
      return
    }

    refreshingRef.current = true
    setIsRefreshing(true)

    try {
      await configuration.refreshToken()
      setLastRefreshTime(Date.now())
      setRefreshCount(prev => prev + 1)
    } finally {
      refreshingRef.current = false
      setIsRefreshing(false)
    }
  }, [configuration.refreshToken])

  const enhancedConfiguration: RefreshConfiguration = {
    ...configuration,
    refreshToken: enhancedRefreshToken
  }

  const fetch = useCallback(
    configureRefreshFetch(enhancedConfiguration),
    [enhancedConfiguration]
  )

  return {
    fetch,
    isRefreshing,
    lastRefreshTime,
    refreshCount
  }
}

/**
 * Hook for intelligent token refresh based on app and network state
 *
 * @param refreshToken - Token refresh function
 * @param options - Refresh options
 */
export function useIntelligentRefresh (
  refreshToken: () => Promise<void>,
  options: {
    refreshOnForeground?: boolean
    refreshOnNetworkReconnect?: boolean
    backgroundRefreshInterval?: number
    enabled?: boolean
  } = {}
): {
    triggerRefresh: () => Promise<void>
    lastRefreshTime: number | null
    refreshCount: number
  } {
  const {
    refreshOnForeground = true,
    refreshOnNetworkReconnect = true,
    backgroundRefreshInterval = 5 * 60 * 1000, // 5 minutes
    enabled = true
  } = options

  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)

  const { isInForeground } = useAppState()
  const { isOnline } = useNetworkState()

  const lastForegroundRef = useRef(isInForeground)
  const lastOnlineRef = useRef(isOnline)
  const backgroundIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const triggerRefresh = useCallback(async () => {
    if (!enabled) return

    try {
      await refreshToken()
      setLastRefreshTime(Date.now())
      setRefreshCount(prev => prev + 1)
    } catch (error) {
      console.error('Token refresh failed:', error)
    }
  }, [refreshToken, enabled])

  // Handle foreground refresh
  useEffect(() => {
    if (
      enabled &&
      refreshOnForeground &&
      isInForeground &&
      !lastForegroundRef.current
    ) {
      // App came to foreground
      triggerRefresh()
    }
    lastForegroundRef.current = isInForeground
  }, [isInForeground, refreshOnForeground, enabled, triggerRefresh])

  // Handle network reconnect refresh
  useEffect(() => {
    if (
      enabled &&
      refreshOnNetworkReconnect &&
      isOnline &&
      !lastOnlineRef.current
    ) {
      // Network reconnected
      triggerRefresh()
    }
    lastOnlineRef.current = isOnline
  }, [isOnline, refreshOnNetworkReconnect, enabled, triggerRefresh])

  // Handle background refresh interval
  useEffect(() => {
    if (enabled && !isInForeground && backgroundRefreshInterval > 0) {
      backgroundIntervalRef.current = setInterval(() => {
        if (isOnline) {
          triggerRefresh()
        }
      }, backgroundRefreshInterval)
    } else if (backgroundIntervalRef.current) {
      clearInterval(backgroundIntervalRef.current)
      backgroundIntervalRef.current = null
    }

    return () => {
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current)
      }
    }
  }, [
    enabled,
    isInForeground,
    isOnline,
    backgroundRefreshInterval,
    triggerRefresh
  ])

  return {
    triggerRefresh,
    lastRefreshTime,
    refreshCount
  }
}

/**
 * Hook for monitoring fetch performance and errors
 *
 * @returns Performance metrics and error tracking
 */
export function useFetchMetrics (): {
  requestCount: number
  errorCount: number
  averageResponseTime: number
  lastError: Error | null
  resetMetrics: () => void
} {
  const [requestCount, setRequestCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [responseTimes, setResponseTimes] = useState<number[]>([])
  const [lastError, setLastError] = useState<Error | null>(null)

  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0

  const resetMetrics = useCallback(() => {
    setRequestCount(0)
    setErrorCount(0)
    setResponseTimes([])
    setLastError(null)
  }, [])

  // Note: These metrics would be updated by the fetch wrapper
  // This is a placeholder for the metrics tracking functionality

  return {
    requestCount,
    errorCount,
    averageResponseTime,
    lastError,
    resetMetrics
  }
}

/**
 * Hook for managing token expiry and proactive refresh
 *
 * @param tokenExpiryTime - Token expiry timestamp
 * @param refreshWindowMs - Time before expiry to refresh (default: 2 minutes)
 * @param onRefreshNeeded - Callback when refresh is needed
 */
export function useTokenExpiry (
  tokenExpiryTime: number | null,
  refreshWindowMs: number = 2 * 60 * 1000,
  onRefreshNeeded?: () => void
): {
    isExpired: boolean
    isExpiringSoon: boolean
    timeUntilExpiry: number | null
    timeUntilRefresh: number | null
  } {
  const [now, setNow] = useState(() => Date.now())

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => { clearInterval(interval) }
  }, [])

  const timeUntilExpiry = tokenExpiryTime ? tokenExpiryTime - now : null
  const timeUntilRefresh = tokenExpiryTime ? tokenExpiryTime - refreshWindowMs - now : null

  const isExpired = timeUntilExpiry !== null && timeUntilExpiry <= 0
  const isExpiringSoon = timeUntilRefresh !== null && timeUntilRefresh <= 0 && !isExpired

  // Trigger refresh callback when refresh is needed
  useEffect(() => {
    if (isExpiringSoon && onRefreshNeeded) {
      onRefreshNeeded()
    }
  }, [isExpiringSoon, onRefreshNeeded])

  return {
    isExpired,
    isExpiringSoon,
    timeUntilExpiry,
    timeUntilRefresh
  }
}
