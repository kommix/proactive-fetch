import { configureRefreshFetch } from '../src'
import type { RefreshConfiguration } from '../src'

describe('configureRefreshFetch', () => {
  it('should call passed fetch with same params', async () => {
    const fetchMock = jest.fn(async () => await Promise.resolve('result'))

    const fetch = configureRefreshFetch({
      shouldRefreshToken: () => false,
      refreshToken: async () => {},
      fetch: fetchMock
    } as RefreshConfiguration)

    await fetch('/foo', { method: 'POST' })

    expect(fetchMock.mock.calls).toEqual([['/foo', { method: 'POST' }]])
  })

  it('should reject with reason when request fails and not refreshing', async () => {
    const fetchMock = jest.fn(async () => await Promise.reject(new Error('I am reason')))

    const fetch = configureRefreshFetch({
      shouldRefreshToken: () => false,
      refreshToken: async () => {},
      fetch: fetchMock
    } as RefreshConfiguration)

    await expect(fetch('/foo', { method: 'POST' })).rejects.toThrow('I am reason')
  })

  it('should call shouldRefreshToken with reason if fetch is rejected', async () => {
    const reason = new Error('I am reason')
    const fetchMock = jest.fn(async () => await Promise.reject(reason))
    const shouldRefreshTokenSpy = jest.fn(() => false)

    const fetch = configureRefreshFetch({
      shouldRefreshToken: shouldRefreshTokenSpy,
      refreshToken: async () => {},
      fetch: fetchMock
    } as RefreshConfiguration)

    await expect(fetch('/foo', { method: 'POST' })).rejects.toThrow()
    expect(shouldRefreshTokenSpy.mock.calls).toEqual([[reason]])
  })

  it('should call refreshToken when shouldRefreshToken returns true', async () => {
    const reason = new Error('I am reason')
    const fetchMock = jest.fn()
      .mockImplementationOnce(async () => await Promise.reject(reason))
      .mockImplementationOnce(async () => await Promise.resolve('success'))

    const refreshTokenSpy = jest.fn().mockResolvedValue(undefined)

    const fetch = configureRefreshFetch({
      shouldRefreshToken: () => true,
      refreshToken: refreshTokenSpy,
      fetch: fetchMock
    } as RefreshConfiguration)

    const result = await fetch('/foo', { method: 'POST' })

    expect(refreshTokenSpy).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toBe('success')
  })

  it('should retry request after successful token refresh', async () => {
    const reason = new Error('Token expired')
    const fetchMock = jest.fn()
      .mockImplementationOnce(async () => await Promise.reject(reason))
      .mockImplementationOnce(async () => await Promise.resolve('success after refresh'))

    const fetch = configureRefreshFetch({
      shouldRefreshToken: (error: Error) => error.message === 'Token expired',
      refreshToken: async () => {
        // Simulate token refresh
      },
      fetch: fetchMock
    } as RefreshConfiguration)

    const result = await fetch('/api/data', { method: 'GET' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith('/api/data', { method: 'GET' })
    expect(result).toBe('success after refresh')
  })

  it('should throw original error if refresh fails', async () => {
    const originalError = new Error('Token expired')
    const refreshError = new Error('Refresh failed')

    const fetchMock = jest.fn(async () => await Promise.reject(originalError))
    const refreshTokenMock = jest.fn(async () => await Promise.reject(refreshError))

    const fetch = configureRefreshFetch({
      shouldRefreshToken: () => true,
      refreshToken: refreshTokenMock,
      fetch: fetchMock
    } as RefreshConfiguration)

    await expect(fetch('/api/data')).rejects.toThrow('Token expired')
  })

  it('should handle concurrent requests during token refresh', async () => {
    const tokenExpiredError = new Error('Token expired')
    let refreshCallCount = 0

    const fetchMock = jest.fn()
      .mockImplementation(async () => {
        if (refreshCallCount === 0) {
          return await Promise.reject(tokenExpiredError)
        }
        return await Promise.resolve('success')
      })

    const refreshTokenMock = jest.fn().mockImplementation(async () => {
      refreshCallCount++
      // Simulate async refresh delay
      await new Promise(resolve => setTimeout(resolve, 10))
    })

    const fetch = configureRefreshFetch({
      shouldRefreshToken: (error: Error) => error.message === 'Token expired',
      refreshToken: refreshTokenMock,
      fetch: fetchMock
    } as RefreshConfiguration)

    // Make multiple concurrent requests
    const promises = [
      fetch('/api/data1'),
      fetch('/api/data2'),
      fetch('/api/data3')
    ]

    const results = await Promise.all(promises)

    // Should only refresh token once, not for each request
    expect(refreshTokenMock).toHaveBeenCalledTimes(1)
    expect(results).toEqual(['success', 'success', 'success'])
  })

  it('should queue requests while refresh is in progress', async () => {
    const tokenExpiredError = new Error('Token expired')
    let isRefreshComplete = false

    const fetchMock = jest.fn()
      .mockImplementation(async () => {
        if (!isRefreshComplete) {
          return await Promise.reject(tokenExpiredError)
        }
        return await Promise.resolve('success')
      })

    const refreshTokenMock = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      isRefreshComplete = true
    })

    const fetch = configureRefreshFetch({
      shouldRefreshToken: (error: Error) => error.message === 'Token expired',
      refreshToken: refreshTokenMock,
      fetch: fetchMock
    } as RefreshConfiguration)

    // Start first request that will trigger refresh
    const promise1 = fetch('/api/data1')

    // Start second request while first is refreshing
    await new Promise(resolve => setTimeout(resolve, 10))
    const promise2 = fetch('/api/data2')

    const results = await Promise.all([promise1, promise2])

    expect(refreshTokenMock).toHaveBeenCalledTimes(1)
    expect(results).toEqual(['success', 'success'])
  })
})
