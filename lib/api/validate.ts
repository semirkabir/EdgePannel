import { z } from 'zod'
import { NextRequest } from 'next/server'
import { ApiError } from './middleware'
import { ErrorCodes } from './error-codes'

/**
 * Validation utilities for API endpoints
 *
 * These utilities provide consistent error handling and validation
 * across all API routes to prevent injection attacks and malformed requests.
 */

/**
 * Validate and parse request body against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param body - Request body to validate
 * @returns Parsed and validated data
 * @throws ApiError with 400 status if validation fails
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): z.infer<T> {
  try {
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      throw new ApiError(
        400,
        'Invalid request body',
        ErrorCodes.VALIDATION_ERROR,
        formattedErrors
      )
    }
    throw error
  }
}

/**
 * Validate and parse query parameters against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param searchParams - URLSearchParams from request
 * @returns Parsed and validated data
 * @throws ApiError with 400 status if validation fails
 */
export function validateQuery<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams
): z.infer<T> {
  const params: Record<string, string | undefined> = {}
  searchParams.forEach((value, key) => {
    params[key] = value || undefined
  })

  try {
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      throw new ApiError(
        400,
        'Invalid query parameters',
        ErrorCodes.VALIDATION_ERROR,
        formattedErrors
      )
    }
    throw error
  }
}

/**
 * Validate and parse URL path parameters against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param params - Path parameters object
 * @returns Parsed and validated data
 * @throws ApiError with 400 status if validation fails
 */
export function validateParams<T extends z.ZodTypeAny>(
  schema: T,
  params: Record<string, string | string[]>
): z.infer<T> {
  try {
    return schema.parse(params)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      throw new ApiError(
        400,
        'Invalid path parameters',
        ErrorCodes.VALIDATION_ERROR,
        formattedErrors
      )
    }
    throw error
  }
}

/**
 * Safe parse that returns a result object instead of throwing
 * Useful for optional validation or when you want to handle errors differently
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Result object with success flag and data or errors
 */
export function safeValidate<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, errors: result.error }
  }
}

/**
 * Validate JSON body from request
 * Combines parsing and validation in one step
 *
 * @param request - NextRequest object
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated data
 * @throws ApiError if JSON parsing or validation fails
 */
export async function validateRequestBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await request.json()
    return validateBody(schema, body)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      400,
      'Invalid JSON in request body',
      ErrorCodes.VALIDATION_ERROR,
      { originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Validate query parameters from request
 *
 * @param request - NextRequest object
 * @param schema - Zod schema to validate against
 * @returns Parsed and validated data
 */
export function validateRequestQuery<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): z.infer<T> {
  const searchParams = request.nextUrl.searchParams
  return validateQuery(schema, searchParams)
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 *
 * @param input - String to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeString(
  input: string,
  options: {
    trim?: boolean
    maxLength?: number
    allowedChars?: RegExp
  } = {}
): string {
  const { trim = true, maxLength, allowedChars } = options

  let sanitized = input

  if (trim) {
    sanitized = sanitized.trim()
  }

  if (maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  if (allowedChars) {
    sanitized = sanitized.replace(new RegExp(`[^${allowedChars.source}]`, 'g'), '')
  }

  // Remove common XSS patterns
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')

  return sanitized
}

/**
 * Create a validated middleware wrapper
 * Automatically validates query parameters or body before handler execution
 *
 * @param schema - Zod schema for validation
 * @param type - Type of validation ('query' or 'body')
 * @returns Middleware function
 */
export function withValidation<T extends z.ZodTypeAny>(
  schema: T,
  type: 'query' | 'body' = 'query'
) {
  return function (
    handler: (data: z.infer<T>, request: NextRequest) => Promise<Response>
  ) {
    return async (request: NextRequest) => {
      const data = type === 'query'
        ? validateRequestQuery(request, schema)
        : await validateRequestBody(request, schema)

      return handler(data, request)
    }
  }
}
