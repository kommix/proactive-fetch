/**
 * Environment detection utilities for cross-platform compatibility
 *
 * Detects the runtime environment to enable platform-specific optimizations
 * and feature detection across Web, Node.js, and React Native environments.
 */

import type { Environment } from './types'

/**
 * Cached environment detection result to avoid repeated checks
 */
let cachedEnvironment: Environment | null = null

/**
 * Detects the current runtime environment with comprehensive checks
 *
 * @returns Environment detection results
 */
export function detectEnvironment (): Environment {
  // Return cached result if available
  if (cachedEnvironment !== null) {
    return cachedEnvironment
  }

  const env: Environment = {
    isReactNative: false,
    isNode: false,
    isBrowser: false,
    supportsMMKV: false
  }

  // React Native detection - multiple approaches for reliability
  if (
    typeof navigator !== 'undefined' &&
    navigator.product === 'ReactNative'
  ) {
    env.isReactNative = true
  } else if (
    typeof global !== 'undefined' &&
    (global as any).HermesInternal !== undefined
  ) {
    // Hermes engine detection (React Native)
    env.isReactNative = true
  } else if (
    (typeof (global as any).__DEV__ !== 'undefined') ||
    (typeof global !== 'undefined' && (global as any).__DEV__ !== undefined)
  ) {
    // React Native development mode detection
    env.isReactNative = true
  }

  // Node.js detection
  if (
    process?.versions?.node !== undefined &&
    !env.isReactNative
  ) {
    env.isNode = true
  }

  // Browser detection (excluding React Native)
  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    !env.isReactNative
  ) {
    env.isBrowser = true
  }

  // MMKV support detection for React Native
  if (env.isReactNative) {
    try {
      // Check if react-native-mmkv is available
      // We use require.resolve to avoid actually importing it
      const mmkvAvailable = typeof require !== 'undefined' &&
        (() => {
          try {
            require.resolve('react-native-mmkv')
            return true
          } catch {
            return false
          }
        })()

      env.supportsMMKV = mmkvAvailable
    } catch {
      env.supportsMMKV = false
    }
  }

  // Cache the result
  cachedEnvironment = env

  return env
}

/**
 * Clears the cached environment detection result
 * Useful for testing or when the environment might change
 */
export function clearEnvironmentCache (): void {
  cachedEnvironment = null
}

/**
 * Convenience functions for common environment checks
 */
export const isReactNative = (): boolean => detectEnvironment().isReactNative
export const isNode = (): boolean => detectEnvironment().isNode
export const isBrowser = (): boolean => detectEnvironment().isBrowser
export const supportsMMKV = (): boolean => detectEnvironment().supportsMMKV

/**
 * Gets the platform identifier string
 */
export function getPlatform (): 'react-native' | 'node' | 'browser' | 'unknown' {
  const env = detectEnvironment()

  if (env.isReactNative) return 'react-native'
  if (env.isNode) return 'node'
  if (env.isBrowser) return 'browser'

  return 'unknown'
}

/**
 * Feature detection for storage capabilities
 */
export interface StorageCapabilities {
  hasLocalStorage: boolean
  hasAsyncStorage: boolean
  hasMMKV: boolean
  hasSecureStore: boolean
}

/**
 * Detects available storage mechanisms in the current environment
 */
export function detectStorageCapabilities (): StorageCapabilities {
  const env = detectEnvironment()

  const capabilities: StorageCapabilities = {
    hasLocalStorage: false,
    hasAsyncStorage: false,
    hasMMKV: false,
    hasSecureStore: false
  }

  if (env.isBrowser) {
    capabilities.hasLocalStorage = typeof localStorage !== 'undefined'
  }

  if (env.isReactNative) {
    // Check for AsyncStorage
    try {
      if (typeof require !== 'undefined') {
        try {
          require.resolve('@react-native-async-storage/async-storage')
          capabilities.hasAsyncStorage = true
        } catch {
          // Try legacy AsyncStorage
          try {
            require.resolve('react-native')
            // React Native < 0.60 had AsyncStorage built-in
            capabilities.hasAsyncStorage = true
          } catch {
            capabilities.hasAsyncStorage = false
          }
        }
      }
    } catch {
      capabilities.hasAsyncStorage = false
    }

    // Check for MMKV
    capabilities.hasMMKV = env.supportsMMKV

    // Check for Expo SecureStore
    try {
      if (typeof require !== 'undefined') {
        require.resolve('expo-secure-store')
        capabilities.hasSecureStore = true
      }
    } catch {
      capabilities.hasSecureStore = false
    }
  }

  return capabilities
}

/**
 * Validates if fetch is available in the current environment
 */
export function validateFetchSupport (): {
  isSupported: boolean
  polyfillNeeded: boolean
  recommendations: string[]
} {
  const recommendations: string[] = []
  let isSupported = false
  let polyfillNeeded = false

  if (typeof fetch !== 'undefined') {
    isSupported = true
  } else {
    polyfillNeeded = true

    const env = detectEnvironment()

    if (env.isNode) {
      recommendations.push('Install node-fetch: npm install node-fetch')
      recommendations.push('Or use Node.js 18+ which has built-in fetch')
    } else if (env.isReactNative) {
      recommendations.push('React Native should have fetch built-in')
      recommendations.push('Check React Native version (0.60+ recommended)')
    } else {
      recommendations.push('Install a fetch polyfill for older browsers')
      recommendations.push('Consider using whatwg-fetch polyfill')
    }
  }

  return {
    isSupported,
    polyfillNeeded,
    recommendations
  }
}

/**
 * Gets environment-specific configuration recommendations
 */
export function getEnvironmentRecommendations (): {
  platform: string
  storageAdapter: string
  features: string[]
  optimizations: string[]
} {
  const env = detectEnvironment()
  const storage = detectStorageCapabilities()

  let storageAdapter = 'memory'
  const features: string[] = []
  const optimizations: string[] = []

  if (env.isReactNative) {
    if (storage.hasMMKV) {
      storageAdapter = 'mmkv'
      features.push('Fast synchronous storage')
      features.push('Built-in encryption support')
      optimizations.push('Use MMKV for token storage')
    } else if (storage.hasAsyncStorage) {
      storageAdapter = 'asyncstorage'
      features.push('Persistent storage')
      optimizations.push('Consider upgrading to MMKV for better performance')
    }

    if (storage.hasSecureStore) {
      features.push('Secure credential storage (Expo)')
      optimizations.push('Use SecureStore for sensitive data in Expo apps')
    }

    optimizations.push('Enable proactive refresh to prevent UI blocking')
    optimizations.push('Use background app state detection for token refresh')
  } else if (env.isBrowser) {
    if (storage.hasLocalStorage) {
      storageAdapter = 'localstorage'
      features.push('Browser persistent storage')
      optimizations.push('Use localStorage for token persistence')
      optimizations.push('Consider sessionStorage for temporary tokens')
    }

    optimizations.push('Use Web Workers for background token refresh')
    optimizations.push('Implement visibility API for tab focus handling')
  } else if (env.isNode) {
    storageAdapter = 'filesystem'
    features.push('File system storage')
    optimizations.push('Use secure file permissions for token storage')
    optimizations.push('Consider Redis for distributed applications')
  }

  return {
    platform: getPlatform(),
    storageAdapter,
    features,
    optimizations
  }
}
