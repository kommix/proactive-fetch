import merge from 'lodash/merge'
import type { FetchJSONResponse, ResponseBody, ResponseError } from './types'

/**
 * Enhanced fetch function that automatically handles JSON requests and responses.
 *
 * Features:
 * - Automatically sets Content-Type header for requests with body
 * - Parses JSON responses based on Content-Type header
 * - Converts non-ok responses to ResponseError instances
 * - Graceful handling of invalid JSON responses
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (headers, method, body, etc.)
 * @returns Promise resolving to response object with parsed body
 */
const fetchJSON = async (
  url: string | Request | URL,
  options: RequestInit = {}
): Promise<FetchJSONResponse> => {
  // Only set Content-Type header when there's a body to describe
  const fetchOptions = typeof options.body === 'undefined'
    ? options
    : merge(
      {
        headers: {
          'Content-Type': 'application/json'
        }
      },
      options
    )

  const response = await fetch(url, fetchOptions)
  const body = await getResponseBody(response)

  return checkStatus({ response, body })
}

/**
 * Extracts and parses the response body based on Content-Type header
 */
const getResponseBody = async (response: Response): Promise<ResponseBody | null | string> => {
  const contentType = response.headers.get('content-type')
  const isJSON = contentType?.includes('json') ?? false

  if (isJSON) {
    const text = await response.clone().text()
    return tryParseJSON(text)
  } else {
    return await response.clone().text()
  }
}

/**
 * Safely attempts to parse JSON string, throwing descriptive error on failure
 */
const tryParseJSON = (json: string): ResponseBody | null => {
  if (json === '') {
    return null
  }

  try {
    return JSON.parse(json) as ResponseBody
  } catch (error) {
    throw new Error(`Failed to parse unexpected JSON response: ${json}`)
  }
}

/**
 * Custom error class for HTTP response errors
 */
class ResponseErrorImpl extends Error implements ResponseError {
  public readonly name = 'ResponseError'
  public readonly status: number
  public readonly response: Response
  public readonly body: ResponseBody | null | string

  constructor (status: number, response: Response, body: ResponseBody | null | string) {
    super(`HTTP ${status} Error`)
    this.status = status
    this.response = response
    this.body = body

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ResponseErrorImpl.prototype)
  }
}

/**
 * Checks response status and throws ResponseError for non-ok responses
 */
const checkStatus = ({ response, body }: { response: Response, body: ResponseBody | null | string }): FetchJSONResponse => {
  if (response.ok) {
    return { response, body }
  } else {
    throw new ResponseErrorImpl(response.status, response, body)
  }
}

export default fetchJSON
export { ResponseErrorImpl as ResponseError }
