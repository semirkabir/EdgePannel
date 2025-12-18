import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withErrorHandler, validateQuery } from '@/lib/api/middleware'
import { queryAuditLogs } from '@/lib/audit/audit-logger'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const AuditLogQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  status: z.enum(['SUCCESS', 'FAILURE', 'ERROR']).optional(),
  startDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(1000)).default('100'),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)).default('0'),
})

export const GET = withErrorHandler(
  withAuth(async (userId: string, request: NextRequest) => {
    // Check if user is admin (you can add admin check here)
    // For now, users can only see their own audit logs
    const params = validateQuery(AuditLogQuerySchema, request.nextUrl.searchParams)

    // If userId is not specified, default to current user
    const queryUserId = params.userId || userId

    // Users can only query their own logs unless they're admin
    // TODO: Add admin check
    if (queryUserId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Can only view own audit logs' },
        { status: 403 }
      )
    }

    const result = await queryAuditLogs({
      userId: queryUserId,
      action: params.action as any,
      resource: params.resource as any,
      resourceId: params.resourceId,
      status: params.status,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit,
      offset: params.offset,
    })

    return NextResponse.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          total: result.total,
          limit: params.limit,
          offset: params.offset,
          hasMore: result.hasMore,
        },
      },
    })
  })
)

