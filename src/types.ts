/**
 * Core types for proactive-fetch library
 */

export type FetchFunction = (url: string | Request | URL, options?: RequestInit) => Promise<Response>

export type EnhancedFetchFunction = (url: string | Request | URL, options?: RequestInit) => Promise<unknown>

export interface RefreshConfiguration {
  /** Function that handles token refresh logic */
  refreshToken: () => Promise<void>
  /** Function that determines if a request error should trigger token refresh */
  shouldRefreshToken: (error: unknown) => boolean
  /** The fetch function to wrap with refresh capabilities */
  fetch: EnhancedFetchFunction
}

export type ResponseBody = Record<string, unknown>

export interface FetchJSONResponse {
  response: Response
  body: ResponseBody | null | string
}

export class ResponseError extends Error {
  public readonly name = 'ResponseError'
  public readonly status: number
  public readonly response: Response
  public readonly body: ResponseBody | null | string

  constructor (status: number, response: Response, body: ResponseBody | null | string) {
    super(`HTTP ${status} Error`)
    this.status = status
    this.response = response
    this.body = body
  }
}

/**
 * Enhanced configuration for proactive refresh features
 */
export interface ProactiveConfiguration extends RefreshConfiguration {
  /** Enable proactive token refresh (refresh before expiry) */
  enableProactiveRefresh?: boolean
  /** Time in milliseconds before token expiry to trigger refresh */
  refreshWindowMs?: number
  /** Function to extract expiry time from token */
  tokenExpiryExtractor?: (token: string) => number
  /** Storage adapter for token persistence */
  storage?: StorageAdapter
}

/**
 * Storage adapter interface for different storage backends
 */
export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null> | string | null
  setItem: (key: string, value: string) => Promise<void> | void
  removeItem: (key: string) => Promise<void> | void
  clear?: () => Promise<void> | void
}

/**
 * Environment detection results
 */
export interface Environment {
  isReactNative: boolean
  isNode: boolean
  isBrowser: boolean
  supportsMMKV: boolean
}
