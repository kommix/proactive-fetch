/**
 * Proactive Fetch - Enhanced fetch wrapper with proactive token refresh
 *
 * A modern, TypeScript-first library that extends the capabilities of the original
 * refresh-fetch with proactive token management, React Native support, and
 * sophisticated concurrency handling.
 *
 * @author Jan Vlcek <vlki@vlki.cz> (original refresh-fetch)
 * @author Enhanced by Your Team (proactive features)
 */

import configureRefreshFetch from './configureRefreshFetch'
import fetchJSON, { ResponseError } from './fetchJSON'

// Export core functionality
export { configureRefreshFetch, fetchJSON, ResponseError }

// Export environment detection
export * from './environment'

// Export React Native platform support
export * from './platforms/react-native'

// Export React hooks (optional peer dependency)
export * from './hooks'

// Export types for consumers
export type {
  RefreshConfiguration,
  ProactiveConfiguration,
  EnhancedFetchFunction,
  FetchFunction,
  FetchJSONResponse,
  ResponseBody,
  StorageAdapter,
  Environment
} from './types'

// Default export for convenience
export default configureRefreshFetch
