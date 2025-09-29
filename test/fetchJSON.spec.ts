import { Headers } from 'node-fetch'
import { fetchJSON, ResponseError } from '../src'

// Mock global fetch for Node.js environment
const mockFetch = jest.fn()
Object.defineProperty(global, 'fetch', { value: mockFetch, writable: true })

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchJSON', () => {
  it('should call fetch with no additional headers when no body is provided', async () => {
    // Mock successful response
    const mockText = jest.fn().mockResolvedValue('')
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    mockFetch.mockResolvedValue({
      clone: mockClone,
      headers: new Headers(),
      ok: true
    })

    const url = '/api/test'
    const options = { method: 'GET' }

    await fetchJSON(url, options)

    expect(mockFetch).toHaveBeenCalledWith(url, options)
  })

  it('should add Content-Type header when body is provided', async () => {
    const mockText = jest.fn().mockResolvedValue('')
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    mockFetch.mockResolvedValue({
      clone: mockClone,
      headers: new Headers(),
      ok: true
    })

    const url = '/api/create'
    const options = {
      method: 'POST',
      body: JSON.stringify({ name: 'test' })
    }

    await fetchJSON(url, options)

    expect(mockFetch).toHaveBeenCalledWith(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  })

  it('should preserve existing headers while adding Content-Type', async () => {
    const mockText = jest.fn().mockResolvedValue('')
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    mockFetch.mockResolvedValue({
      clone: mockClone,
      headers: new Headers(),
      ok: true
    })

    const url = '/api/update'
    const options = {
      method: 'PUT',
      body: JSON.stringify({ id: 1 }),
      headers: {
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      }
    }

    await fetchJSON(url, options)

    expect(mockFetch).toHaveBeenCalledWith(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      }
    })
  })

  it('should parse JSON response when Content-Type is application/json', async () => {
    const responseData = { success: true, data: 'test' }
    const mockText = jest.fn().mockResolvedValue(JSON.stringify(responseData))
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    const mockResponse = {
      clone: mockClone,
      headers: new Headers({ 'content-type': 'application/json' }),
      ok: true
    }

    mockFetch.mockResolvedValue(mockResponse)

    const result = await fetchJSON('/api/data')

    expect(result).toEqual({
      response: mockResponse,
      body: responseData
    })
  })

  it('should return text response when Content-Type is not JSON', async () => {
    const responseText = 'Plain text response'
    const mockText = jest.fn().mockResolvedValue(responseText)
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    const mockResponse = {
      clone: mockClone,
      headers: new Headers({ 'content-type': 'text/plain' }),
      ok: true
    }

    mockFetch.mockResolvedValue(mockResponse)

    const result = await fetchJSON('/api/text')

    expect(result).toEqual({
      response: mockResponse,
      body: responseText
    })
  })

  it('should throw ResponseError for non-ok responses', async () => {
    const errorBody = { error: 'Not found', code: 404 }
    const mockText = jest.fn().mockResolvedValue(JSON.stringify(errorBody))
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    const mockResponse = {
      clone: mockClone,
      headers: new Headers({ 'content-type': 'application/json' }),
      ok: false,
      status: 404
    }

    mockFetch.mockResolvedValue(mockResponse)

    await expect(fetchJSON('/api/notfound')).rejects.toThrow(ResponseError)

    try {
      await fetchJSON('/api/notfound')
    } catch (error) {
      expect(error).toBeInstanceOf(ResponseError)
      expect((error as ResponseError).status).toBe(404)
      expect((error as ResponseError).body).toEqual(errorBody)
      expect((error as ResponseError).response).toBe(mockResponse)
    }
  })

  it('should handle empty JSON responses', async () => {
    const mockText = jest.fn().mockResolvedValue('')
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    const mockResponse = {
      clone: mockClone,
      headers: new Headers({ 'content-type': 'application/json' }),
      ok: true
    }

    mockFetch.mockResolvedValue(mockResponse)

    const result = await fetchJSON('/api/empty')

    expect(result).toEqual({
      response: mockResponse,
      body: null
    })
  })

  it('should throw descriptive error for invalid JSON', async () => {
    const invalidJson = '{ invalid json }'
    const mockText = jest.fn().mockResolvedValue(invalidJson)
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    mockFetch.mockResolvedValue({
      clone: mockClone,
      headers: new Headers({ 'content-type': 'application/json' }),
      ok: true
    })

    await expect(fetchJSON('/api/invalid')).rejects.toThrow('Failed to parse unexpected JSON response')
  })

  it('should handle responses with partial JSON content-type', async () => {
    const responseData = { message: 'success' }
    const mockText = jest.fn().mockResolvedValue(JSON.stringify(responseData))
    const mockClone = jest.fn().mockReturnValue({ text: mockText })

    const mockResponse = {
      clone: mockClone,
      headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
      ok: true
    }

    mockFetch.mockResolvedValue(mockResponse)

    const result = await fetchJSON('/api/charset')

    expect(result.body).toEqual(responseData)
  })
})
