/**
 * Tests for environment detection functionality
 */

import {
  detectEnvironment,
  clearEnvironmentCache,
  isReactNative,
  isNode,
  isBrowser,
  supportsMMKV,
  getPlatform,
  detectStorageCapabilities,
  validateFetchSupport,
  getEnvironmentRecommendations
} from '../src/environment'

// Mock global objects for testing
const mockGlobalObjects = () => {
  // Store original values
  const originalProcess = global.process
  const originalWindow = (global as any).window
  const originalDocument = (global as any).document
  const originalNavigator = (global as any).navigator
  const originalGlobal = global.global
  const originalRequire = global.require

  return {
    restore: () => {
      global.process = originalProcess
      ;(global as any).window = originalWindow
      ;(global as any).document = originalDocument
      ;(global as any).navigator = originalNavigator
      global.global = originalGlobal
      global.require = originalRequire
    },
    setNode: () => {
      global.process = {
        versions: { node: '18.0.0' }
      } as any
      delete (global as any).window
      delete (global as any).document
      delete (global as any).navigator
    },
    setBrowser: () => {
      delete (global as any).process
      ;(global as any).window = {}
      ;(global as any).document = {}
      delete (global as any).navigator
    },
    setReactNative: () => {
      delete (global as any).process
      delete (global as any).window
      delete (global as any).document
      ;(global as any).navigator = { product: 'ReactNative' }
    },
    setReactNativeHermes: () => {
      delete (global as any).process
      delete (global as any).window
      delete (global as any).document
      delete (global as any).navigator
      ;(global as any).global = { HermesInternal: {} }
    },
    setUnknown: () => {
      delete (global as any).process
      delete (global as any).window
      delete (global as any).document
      delete (global as any).navigator
      delete (global as any).global
    }
  }
}

describe('Environment Detection', () => {
  let mockGlobals: ReturnType<typeof mockGlobalObjects>

  beforeEach(() => {
    mockGlobals = mockGlobalObjects()
    clearEnvironmentCache()
  })

  afterEach(() => {
    mockGlobals.restore()
    clearEnvironmentCache()
  })

  describe('detectEnvironment', () => {
    it('should detect Node.js environment', () => {
      mockGlobals.setNode()

      const env = detectEnvironment()

      expect(env.isNode).toBe(true)
      expect(env.isBrowser).toBe(false)
      expect(env.isReactNative).toBe(false)
      expect(env.supportsMMKV).toBe(false)
    })

    it('should detect browser environment', () => {
      mockGlobals.setBrowser()

      const env = detectEnvironment()

      expect(env.isBrowser).toBe(true)
      expect(env.isNode).toBe(false)
      expect(env.isReactNative).toBe(false)
      expect(env.supportsMMKV).toBe(false)
    })

    it('should detect React Native environment via navigator', () => {
      mockGlobals.setReactNative()

      const env = detectEnvironment()

      expect(env.isReactNative).toBe(true)
      expect(env.isNode).toBe(false)
      expect(env.isBrowser).toBe(false)
    })

    it('should detect React Native environment via Hermes', () => {
      mockGlobals.setReactNativeHermes()

      const env = detectEnvironment()

      expect(env.isReactNative).toBe(true)
      expect(env.isNode).toBe(false)
      expect(env.isBrowser).toBe(false)
    })

    it('should cache environment detection results', () => {
      mockGlobals.setNode()

      const env1 = detectEnvironment()
      const env2 = detectEnvironment()

      expect(env1).toBe(env2) // Should return same object reference
    })

    it('should clear cache when requested', () => {
      mockGlobals.setNode()
      const env1 = detectEnvironment()

      clearEnvironmentCache()
      mockGlobals.setBrowser()

      const env2 = detectEnvironment()

      expect(env1.isNode).toBe(true)
      expect(env2.isBrowser).toBe(true)
    })
  })

  describe('convenience functions', () => {
    it('should provide correct convenience function results for Node', () => {
      mockGlobals.setNode()

      expect(isNode()).toBe(true)
      expect(isBrowser()).toBe(false)
      expect(isReactNative()).toBe(false)
      expect(supportsMMKV()).toBe(false)
    })

    it('should provide correct convenience function results for browser', () => {
      mockGlobals.setBrowser()

      expect(isBrowser()).toBe(true)
      expect(isNode()).toBe(false)
      expect(isReactNative()).toBe(false)
      expect(supportsMMKV()).toBe(false)
    })

    it('should provide correct convenience function results for React Native', () => {
      mockGlobals.setReactNative()

      expect(isReactNative()).toBe(true)
      expect(isNode()).toBe(false)
      expect(isBrowser()).toBe(false)
    })
  })

  describe('getPlatform', () => {
    it('should return correct platform identifiers', () => {
      mockGlobals.setNode()
      expect(getPlatform()).toBe('node')

      clearEnvironmentCache()
      mockGlobals.setBrowser()
      expect(getPlatform()).toBe('browser')

      clearEnvironmentCache()
      mockGlobals.setReactNative()
      expect(getPlatform()).toBe('react-native')

      clearEnvironmentCache()
      mockGlobals.setUnknown()
      expect(getPlatform()).toBe('unknown')
    })
  })

  describe('detectStorageCapabilities', () => {
    it('should detect browser storage capabilities', () => {
      mockGlobals.setBrowser()
      ;(global as any).localStorage = {}

      const capabilities = detectStorageCapabilities()

      expect(capabilities.hasLocalStorage).toBe(true)
      expect(capabilities.hasAsyncStorage).toBe(false)
      expect(capabilities.hasMMKV).toBe(false)
      expect(capabilities.hasSecureStore).toBe(false)
    })

    it('should detect React Native storage capabilities', () => {
      mockGlobals.setReactNative()

      // Mock require.resolve for AsyncStorage
      global.require = {
        resolve: jest.fn((module: string) => {
          if (module === '@react-native-async-storage/async-storage') {
            return '/path/to/async-storage'
          }
          throw new Error('Module not found')
        })
      } as any

      const capabilities = detectStorageCapabilities()

      expect(capabilities.hasLocalStorage).toBe(false)
      expect(capabilities.hasAsyncStorage).toBe(true)
      expect(capabilities.hasMMKV).toBe(false)
      expect(capabilities.hasSecureStore).toBe(false)
    })
  })

  describe('validateFetchSupport', () => {
    it('should validate fetch support when available', () => {
      ;(global as any).fetch = jest.fn()

      const validation = validateFetchSupport()

      expect(validation.isSupported).toBe(true)
      expect(validation.polyfillNeeded).toBe(false)
      expect(validation.recommendations).toHaveLength(0)
    })

    it('should provide recommendations when fetch is missing in Node', () => {
      delete (global as any).fetch
      mockGlobals.setNode()

      const validation = validateFetchSupport()

      expect(validation.isSupported).toBe(false)
      expect(validation.polyfillNeeded).toBe(true)
      expect(validation.recommendations).toContain('Install node-fetch: npm install node-fetch')
    })

    it('should provide recommendations when fetch is missing in React Native', () => {
      delete (global as any).fetch
      mockGlobals.setReactNative()

      const validation = validateFetchSupport()

      expect(validation.isSupported).toBe(false)
      expect(validation.polyfillNeeded).toBe(true)
      expect(validation.recommendations.some(r => r.includes('React Native'))).toBe(true)
    })
  })

  describe('getEnvironmentRecommendations', () => {
    it('should provide Node.js recommendations', () => {
      mockGlobals.setNode()

      const recommendations = getEnvironmentRecommendations()

      expect(recommendations.platform).toBe('node')
      expect(recommendations.storageAdapter).toBe('filesystem')
      expect(recommendations.features).toContain('File system storage')
      expect(recommendations.optimizations.some(o => o.includes('Redis'))).toBe(true)
    })

    it('should provide browser recommendations', () => {
      mockGlobals.setBrowser()
      ;(global as any).localStorage = {}

      const recommendations = getEnvironmentRecommendations()

      expect(recommendations.platform).toBe('browser')
      expect(recommendations.storageAdapter).toBe('localstorage')
      expect(recommendations.features).toContain('Browser persistent storage')
      expect(recommendations.optimizations.some(o => o.includes('Web Workers'))).toBe(true)
    })

    it('should provide React Native recommendations with MMKV', () => {
      mockGlobals.setReactNative()

      // Mock MMKV availability
      global.require = {
        resolve: jest.fn((module: string) => {
          if (module === 'react-native-mmkv') {
            return '/path/to/mmkv'
          }
          throw new Error('Module not found')
        })
      } as any

      clearEnvironmentCache()
      const recommendations = getEnvironmentRecommendations()

      expect(recommendations.platform).toBe('react-native')
      expect(recommendations.storageAdapter).toBe('mmkv')
      expect(recommendations.features).toContain('Fast synchronous storage')
      expect(recommendations.optimizations.some(o => o.includes('MMKV'))).toBe(true)
    })
  })
})
