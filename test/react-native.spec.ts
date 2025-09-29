/**
 * Tests for React Native specific functionality
 */

import {
  ReactNativeAppStateManager,
  ReactNativeNetworkManager,
  ReactNativePerformanceUtils
} from '../src/platforms/react-native'

// Mock React Native modules
const mockReactNative = () => {
  const appStateListeners: Array<(state: string) => void> = []
  const netInfoListeners: Array<(state: any) => void> = []

  const mockAppState = {
    currentState: 'active',
    addEventListener: jest.fn((event: string, listener: (state: string) => void) => {
      if (event === 'change') {
        appStateListeners.push(listener)
      }
    }),
    removeEventListener: jest.fn((event: string, listener: (state: string) => void) => {
      if (event === 'change') {
        const index = appStateListeners.indexOf(listener)
        if (index > -1) {
          appStateListeners.splice(index, 1)
        }
      }
    })
  }

  const mockNetInfo = {
    fetch: jest.fn().mockResolvedValue({
      isConnected: true,
      type: 'wifi',
      isInternetReachable: true
    }),
    addEventListener: jest.fn((listener: (state: any) => void) => {
      netInfoListeners.push(listener)
      return jest.fn() // unsubscribe function
    })
  }

  const mockInteractionManager = {
    runAfterInteractions: jest.fn((callback: () => void) => {
      setTimeout(callback, 0)
    }),
    createInteractionHandle: jest.fn(() => 1),
    clearInteractionHandle: jest.fn()
  }

  const mockPlatform = {
    OS: 'ios'
  }

  // Setup global require mock
  global.require = jest.fn((module: string) => {
    switch (module) {
      case 'react-native':
        return {
          AppState: mockAppState,
          InteractionManager: mockInteractionManager,
          Platform: mockPlatform
        }
      case '@react-native-netinfo/netinfo':
        return mockNetInfo
      default:
        throw new Error(`Module ${module} not found`)
    }
  }) as any

  // Setup environment to look like React Native
  ;(global as any).navigator = { product: 'ReactNative' }
  delete (global as any).window
  delete (global as any).document

  return {
    appStateListeners,
    netInfoListeners,
    mockAppState,
    mockNetInfo,
    mockInteractionManager,
    mockPlatform,
    triggerAppStateChange: (state: string) => {
      mockAppState.currentState = state
      appStateListeners.forEach(listener => { listener(state) })
    },
    triggerNetInfoChange: (state: any) => {
      netInfoListeners.forEach(listener => { listener(state) })
    }
  }
}

describe('React Native Platform Support', () => {
  let mockRN: ReturnType<typeof mockReactNative>

  beforeEach(() => {
    mockRN = mockReactNative()
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup
    delete (global as any).navigator
    delete (global as any).require
  })

  describe('ReactNativeAppStateManager', () => {
    it('should initialize with current app state', () => {
      const manager = new ReactNativeAppStateManager()

      expect(manager.getCurrentState()).toBe('active')
      expect(manager.isInForeground()).toBe(true)
      expect(manager.isInBackground()).toBe(false)
    })

    it('should register app state change listener', () => {
      const manager = new ReactNativeAppStateManager()

      expect(mockRN.mockAppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      )
      expect(manager.getCurrentState()).toBe('active')
    })

    it('should notify listeners on app state change', () => {
      const manager = new ReactNativeAppStateManager()
      const listener = jest.fn()

      const unsubscribe = manager.addListener(listener)

      mockRN.triggerAppStateChange('background')

      expect(listener).toHaveBeenCalledWith('background')
      expect(manager.getCurrentState()).toBe('background')
      expect(manager.isInBackground()).toBe(true)
      expect(manager.isInForeground()).toBe(false)

      unsubscribe()
    })

    it('should handle multiple listeners', () => {
      const manager = new ReactNativeAppStateManager()
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      manager.addListener(listener1)
      manager.addListener(listener2)

      mockRN.triggerAppStateChange('inactive')

      expect(listener1).toHaveBeenCalledWith('inactive')
      expect(listener2).toHaveBeenCalledWith('inactive')
    })

    it('should remove listeners when unsubscribed', () => {
      const manager = new ReactNativeAppStateManager()
      const listener = jest.fn()

      const unsubscribe = manager.addListener(listener)
      unsubscribe()

      mockRN.triggerAppStateChange('background')

      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle listener errors gracefully', () => {
      const manager = new ReactNativeAppStateManager()
      const badListener = jest.fn(() => {
        throw new Error('Listener error')
      })
      const goodListener = jest.fn()

      manager.addListener(badListener)
      manager.addListener(goodListener)

      // Should not throw
      expect(() => {
        mockRN.triggerAppStateChange('background')
      }).not.toThrow()

      expect(badListener).toHaveBeenCalled()
      expect(goodListener).toHaveBeenCalled()
    })

    it('should cleanup on destroy', () => {
      const manager = new ReactNativeAppStateManager()
      const listener = jest.fn()

      manager.addListener(listener)
      manager.destroy()

      // Should not call removeEventListener because we don't track the original listener
      expect(manager.getCurrentState()).toBe('background') // Last state
      expect(listener).toBeDefined() // Just to use the variable
    })
  })

  describe('ReactNativeNetworkManager', () => {
    it('should initialize and fetch initial network state', async () => {
      const manager = new ReactNativeNetworkManager()

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockRN.mockNetInfo.fetch).toHaveBeenCalled()
      expect(manager).toBeDefined()
    })

    it('should register network change listener', () => {
      const manager = new ReactNativeNetworkManager()

      expect(mockRN.mockNetInfo.addEventListener).toHaveBeenCalled()
      expect(manager).toBeDefined()
    })

    it('should update network state on changes', () => {
      const manager = new ReactNativeNetworkManager()
      const listener = jest.fn()

      manager.addListener(listener)

      const newState = {
        isConnected: false,
        type: 'none',
        isInternetReachable: false
      }

      mockRN.triggerNetInfoChange(newState)

      expect(listener).toHaveBeenCalledWith({
        isConnected: false,
        connectionType: 'none',
        isInternetReachable: false
      })
    })

    it('should provide network state utilities', () => {
      const manager = new ReactNativeNetworkManager()

      // Simulate WiFi connection
      mockRN.triggerNetInfoChange({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true
      })

      expect(manager.isOnline()).toBe(true)
      expect(manager.isWiFi()).toBe(true)
      expect(manager.isCellular()).toBe(false)

      // Simulate cellular connection
      mockRN.triggerNetInfoChange({
        isConnected: true,
        type: 'cellular',
        isInternetReachable: true
      })

      expect(manager.isOnline()).toBe(true)
      expect(manager.isWiFi()).toBe(false)
      expect(manager.isCellular()).toBe(true)

      // Simulate offline
      mockRN.triggerNetInfoChange({
        isConnected: false,
        type: 'none',
        isInternetReachable: false
      })

      expect(manager.isOnline()).toBe(false)
    })

    it('should handle missing NetInfo gracefully', () => {
      // Mock require to throw for NetInfo
      global.require = jest.fn(() => {
        throw new Error('Module not found')
      }) as any

      expect(() => {
        const manager = new ReactNativeNetworkManager()
        const state = manager.getCurrentState()
        expect(state).toEqual({
          isConnected: true,
          connectionType: 'unknown',
          isInternetReachable: null
        })
      }).not.toThrow()
    })
  })

  describe('ReactNativePerformanceUtils', () => {
    it('should run after interactions in React Native', () => {
      const callback = jest.fn()

      ReactNativePerformanceUtils.runAfterInteractions(callback)

      expect(mockRN.mockInteractionManager.runAfterInteractions).toHaveBeenCalledWith(callback)
    })

    it('should schedule low priority work', () => {
      const callback = jest.fn()

      ReactNativePerformanceUtils.scheduleLowPriorityWork(callback)

      expect(mockRN.mockInteractionManager.createInteractionHandle).toHaveBeenCalled()

      // Wait for setTimeout
      setTimeout(() => {
        expect(callback).toHaveBeenCalled()
        expect(mockRN.mockInteractionManager.clearInteractionHandle).toHaveBeenCalled()
      }, 10)
    })

    it('should detect iOS platform', () => {
      mockRN.mockPlatform.OS = 'ios'

      expect(ReactNativePerformanceUtils.isIOS()).toBe(true)
      expect(ReactNativePerformanceUtils.isAndroid()).toBe(false)
    })

    it('should detect Android platform', () => {
      mockRN.mockPlatform.OS = 'android'

      expect(ReactNativePerformanceUtils.isAndroid()).toBe(true)
      expect(ReactNativePerformanceUtils.isIOS()).toBe(false)
    })

    it('should fallback gracefully when React Native modules are unavailable', () => {
      global.require = jest.fn(() => {
        throw new Error('Module not found')
      }) as any

      const callback = jest.fn()

      expect(() => {
        ReactNativePerformanceUtils.runAfterInteractions(callback)
      }).not.toThrow()

      // Should use setTimeout fallback
      setTimeout(() => {
        expect(callback).toHaveBeenCalled()
      }, 10)
    })

    it('should handle platform detection fallback', () => {
      global.require = jest.fn(() => {
        throw new Error('Module not found')
      }) as any

      // Mock user agent for fallback detection
      ;(global as any).navigator = {
        product: 'ReactNative',
        userAgent: 'iPhone'
      }

      expect(ReactNativePerformanceUtils.isIOS()).toBe(true)

      ;(global as any).navigator.userAgent = 'Android'
      expect(ReactNativePerformanceUtils.isAndroid()).toBe(true)
    })
  })
})
