/**
 * Standard API response types
 * Ensures consistent response structure across all endpoints
 */

import { ErrorCode } from './error-codes'

/**
 * Standard error response
 */
export interface ErrorResponse {
  error: string
  code: ErrorCode
  details?: unknown
  retryAfter?: number
}

/**
 * Standard success response
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data?: T
  message?: string
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    hasMore: boolean
    nextCursor?: string
    nextOffset?: number
    total?: number
    limit: number
    offset: number
  }
}

/**
 * API response wrapper
 */
export type ApiResponse<T = unknown> = 
  | SuccessResponse<T>
  | ErrorResponse

/**
 * Type guard for error responses
 */
export function isErrorResponse(response: ApiResponse): response is ErrorResponse {
  return 'error' in response && 'code' in response
}

/**
 * Type guard for success responses
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return 'success' in response && response.success === true
}

