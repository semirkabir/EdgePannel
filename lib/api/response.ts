
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export type ApiResponse<T = any> = {
    success: boolean
    data?: T
    error?: string
    code?: string
    details?: any
}

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code: string = 'INTERNAL_ERROR',
        public details?: any
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

export function successResponse<T>(data: T, status: number = 200): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
        {
            success: true,
            data,
        },
        { status }
    )
}

export function errorResponse(
    message: string,
    status: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
): NextResponse<ApiResponse> {
    return NextResponse.json(
        {
            success: false,
            error: message,
            code,
            details,
        },
        { status }
    )
}

export function handleApiError(error: any): NextResponse<ApiResponse> {
    console.error('[API Error]', error)

    if (error instanceof ApiError) {
        return errorResponse(error.message, error.statusCode, error.code, error.details)
    }

    if (error instanceof ZodError) {
        return errorResponse('Validation Error', 400, 'VALIDATION_ERROR', error.errors)
    }

    return errorResponse('Internal Server Error', 500)
}
