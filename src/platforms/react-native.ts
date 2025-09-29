/**
 * React Native specific utilities and optimizations
 *
 * Provides React Native-specific features like app state handling,
 * network state detection, and platform optimizations.
 */

import { detectEnvironment } from '../environment'

/**
 * App state types for React Native
 */
export type AppState = 'active' | 'background' | 'inactive' | 'unknown'

/**
 * Network state information
 */
export interface NetworkState {
  isConnected: boolean
  connectionType: string
  isInternetReachable: boolean | null
}

/**
 * React Native app state manager
 * Handles background/foreground transitions for token refresh optimization
 */
export class ReactNativeAppStateManager {
  private listeners: Array<(state: AppState) => void> = []
  private currentState: AppState = 'unknown'
  private appStateModule: any = null

  constructor () {
    this.initializeAppState()
  }

  /**
   * Initialize app state monitoring if in React Native environment
   */
  private initializeAppState (): void {
    const env = detectEnvironment()

    if (!env.isReactNative) {
      return
    }

    try {
      // Dynamically import AppState to avoid issues in non-RN environments
      if (typeof require !== 'undefined') {
        const { AppState } = require('react-native')
        this.appStateModule = AppState

        // Get initial state
        this.currentState = AppState.currentState || 'unknown'

        // Listen to app state changes
        AppState.addEventListener('change', this.handleAppStateChange.bind(this))
      }
    } catch (error) {
      console.warn('Failed to initialize React Native AppState:', error)
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange (nextAppState: AppState): void {
    if (nextAppState !== this.currentState) {
      this.currentState = nextAppState
      this.notifyListeners(nextAppState)
    }
  }

  /**
   * Add listener for app state changes
   */
  public addListener (listener: (state: AppState) => void): () => void {
    this.listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners (state: AppState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('Error in app state listener:', error)
      }
    })
  }

  /**
   * Get current app state
   */
  public getCurrentState (): AppState {
    return this.currentState
  }

  /**
   * Check if app is currently in foreground
   */
  public isInForeground (): boolean {
    return this.currentState === 'active'
  }

  /**
   * Check if app is in background
   */
  public isInBackground (): boolean {
    return this.currentState === 'background'
  }

  /**
   * Cleanup listeners
   */
  public destroy (): void {
    this.listeners = []

    if (this.appStateModule?.removeEventListener) {
      try {
        this.appStateModule.removeEventListener('change', this.handleAppStateChange)
      } catch (error) {
        console.warn('Failed to remove AppState listener:', error)
      }
    }
  }
}

/**
 * React Native network state manager
 * Monitors network connectivity for intelligent token refresh
 */
export class ReactNativeNetworkManager {
  private listeners: Array<(state: NetworkState) => void> = []
  private currentState: NetworkState = {
    isConnected: true,
    connectionType: 'unknown',
    isInternetReachable: null
  }

  constructor () {
    this.initializeNetInfo()
  }

  /**
   * Initialize network info monitoring
   */
  private initializeNetInfo (): void {
    const env = detectEnvironment()

    if (!env.isReactNative) {
      return
    }

    try {
      // Try to load @react-native-netinfo/netinfo
      if (typeof require !== 'undefined') {
        try {
          const NetInfo = require('@react-native-netinfo/netinfo')

          // Get initial state
          NetInfo.fetch().then((state: any) => {
            this.updateNetworkState(state)
          }).catch((error: Error) => {
            console.warn('Failed to fetch initial network state:', error)
          })

          // Listen to network changes
          NetInfo.addEventListener((state: any) => {
            this.updateNetworkState(state)
          })
        } catch {
          console.warn('NetInfo not available - network monitoring disabled')
        }
      }
    } catch (error) {
      console.warn('Failed to initialize network monitoring:', error)
    }
  }

  /**
   * Update network state and notify listeners
   */
  private updateNetworkState (netInfoState: any): void {
    const newState: NetworkState = {
      isConnected: netInfoState.isConnected ?? true,
      connectionType: netInfoState.type ?? 'unknown',
      isInternetReachable: netInfoState.isInternetReachable ?? null
    }

    const hasChanged =
      newState.isConnected !== this.currentState.isConnected ||
      newState.connectionType !== this.currentState.connectionType ||
      newState.isInternetReachable !== this.currentState.isInternetReachable

    if (hasChanged) {
      this.currentState = newState
      this.notifyListeners(newState)
    }
  }

  /**
   * Add listener for network state changes
   */
  public addListener (listener: (state: NetworkState) => void): () => void {
    this.listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners (state: NetworkState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('Error in network state listener:', error)
      }
    })
  }

  /**
   * Get current network state
   */
  public getCurrentState (): NetworkState {
    return { ...this.currentState }
  }

  /**
   * Check if device is online
   */
  public isOnline (): boolean {
    return this.currentState.isConnected &&
           (this.currentState.isInternetReachable !== false)
  }

  /**
   * Check if device has cellular connection
   */
  public isCellular (): boolean {
    return ['cellular', '3g', '4g', '5g'].includes(
      this.currentState.connectionType.toLowerCase()
    )
  }

  /**
   * Check if device has WiFi connection
   */
  public isWiFi (): boolean {
    return this.currentState.connectionType.toLowerCase() === 'wifi'
  }

  /**
   * Cleanup listeners
   */
  public destroy (): void {
    this.listeners = []
    // NetInfo cleanup is handled automatically by the library
  }
}

/**
 * React Native performance utilities
 */
export class ReactNativePerformanceUtils {
  /**
   * Use React Native's InteractionManager to defer operations
   */
  public static runAfterInteractions (callback: () => void): void {
    const env = detectEnvironment()

    if (!env.isReactNative) {
      // Fallback for non-RN environments
      setTimeout(callback, 0)
      return
    }

    try {
      if (typeof require !== 'undefined') {
        const { InteractionManager } = require('react-native')
        InteractionManager.runAfterInteractions(callback)
      } else {
        setTimeout(callback, 0)
      }
    } catch (error) {
      console.warn('InteractionManager not available, using setTimeout:', error)
      setTimeout(callback, 0)
    }
  }

  /**
   * Schedule low-priority work using React Native's scheduler
   */
  public static scheduleLowPriorityWork (callback: () => void): void {
    const env = detectEnvironment()

    if (!env.isReactNative) {
      setTimeout(callback, 0)
      return
    }

    try {
      if (typeof require !== 'undefined') {
        const { InteractionManager } = require('react-native')

        // Use createInteractionHandle for low priority work
        const handle = InteractionManager.createInteractionHandle()

        setTimeout(() => {
          try {
            callback()
          } finally {
            InteractionManager.clearInteractionHandle(handle)
          }
        }, 0)
      } else {
        setTimeout(callback, 0)
      }
    } catch (error) {
      console.warn('Failed to schedule low priority work:', error)
      setTimeout(callback, 0)
    }
  }

  /**
   * Check if running on iOS
   */
  public static isIOS (): boolean {
    const env = detectEnvironment()

    if (!env.isReactNative) {
      return false
    }

    try {
      if (typeof require !== 'undefined') {
        const { Platform } = require('react-native')
        return Platform.OS === 'ios'
      }
    } catch {
      // Fallback detection
      return typeof navigator !== 'undefined' &&
             /iPad|iPhone|iPod/.test(navigator.userAgent)
    }

    return false
  }

  /**
   * Check if running on Android
   */
  public static isAndroid (): boolean {
    const env = detectEnvironment()

    if (!env.isReactNative) {
      return false
    }

    try {
      if (typeof require !== 'undefined') {
        const { Platform } = require('react-native')
        return Platform.OS === 'android'
      }
    } catch {
      // Fallback detection
      return typeof navigator !== 'undefined' &&
             navigator.userAgent.includes('Android')
    }

    return false
  }
}

/**
 * Singleton instances for global access
 */
export const appStateManager = new ReactNativeAppStateManager()
export const networkManager = new ReactNativeNetworkManager()

/**
 * Cleanup function for React Native managers
 */
export function cleanup (): void {
  appStateManager.destroy()
  networkManager.destroy()
}
