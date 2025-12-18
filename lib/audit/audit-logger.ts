/**
 * Audit logging service
 * Tracks all security-relevant events for compliance and forensics
 */

import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

export type AuditAction =
  // Authentication
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET'
  | 'EMAIL_CHANGED'
  | 'EMAIL_VERIFIED'

  // API Keys
  | 'API_KEY_CREATED'
  | 'API_KEY_UPDATED'
  | 'API_KEY_DELETED'
  | 'API_KEY_ROTATED'
  | 'API_KEY_EXPIRED'
  | 'API_KEY_ACCESSED'

  // Trading
  | 'TRADE_EXECUTED'
  | 'TRADE_CANCELLED'
  | 'TRADE_FAILED'

  // Settings
  | 'SETTINGS_UPDATED'
  | 'PROFILE_UPDATED'

  // Security
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_ACCESS'
  | 'SUSPICIOUS_ACTIVITY'

  // System
  | 'SYSTEM_EVENT'

export type AuditResource =
  | 'user'
  | 'api_key'
  | 'trade'
  | 'settings'
  | 'session'
  | 'system'

export interface AuditLogContext {
  [key: string]: unknown
}

export interface AuditLogData {
  userId?: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  details?: AuditLogContext
  ipAddress?: string
  userAgent?: string
  status?: 'SUCCESS' | 'FAILURE' | 'ERROR'
  errorMessage?: string
}

/**
 * Create an audit log entry
 */
export async function auditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId || null,
        details: (data.details as any) || {},
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        status: data.status || 'SUCCESS',
        errorMessage: data.errorMessage || null,
      },
    })

    // Also log to application logger for immediate visibility
    logger.info(`[AUDIT] ${data.action} on ${data.resource}`, {
      userId: data.userId?.substring(0, 8) + '...',
      resourceId: data.resourceId,
      status: data.status,
    })
  } catch (error) {
    // Don't throw - audit logging should never break the application
    logger.error('Failed to create audit log', error, {
      action: data.action,
      resource: data.resource,
    })
  }
}

/**
 * Extract IP address and user agent from request
 */
export function extractRequestMetadata(request: Request): {
  ipAddress: string | undefined
  userAgent: string | undefined
} {
  const headers = request.headers || (request as any).headers || {}

  // Get IP address (check various headers for proxies/load balancers)
  const ipAddress =
    headers.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get?.('x-real-ip') ||
    headers.get?.('cf-connecting-ip') || // Cloudflare
    headers.get?.('x-client-ip') ||
    undefined

  const userAgent = headers.get?.('user-agent') || undefined

  return { ipAddress, userAgent }
}

/**
 * Helper to create audit log from NextRequest
 */
export async function auditLogFromRequest(
  request: Request,
  data: Omit<AuditLogData, 'ipAddress' | 'userAgent'>
): Promise<void> {
  const { ipAddress, userAgent } = extractRequestMetadata(request)
  await auditLog({
    ...data,
    ipAddress,
    userAgent,
  })
}

/**
 * Query audit logs
 */
export interface AuditLogQuery {
  userId?: string
  action?: AuditAction | AuditAction[]
  resource?: AuditResource | AuditResource[]
  resourceId?: string
  status?: 'SUCCESS' | 'FAILURE' | 'ERROR'
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export async function queryAuditLogs(query: AuditLogQuery) {
  const where: any = {}

  if (query.userId) {
    where.userId = query.userId
  }

  if (query.action) {
    if (Array.isArray(query.action)) {
      where.action = { in: query.action }
    } else {
      where.action = query.action
    }
  }

  if (query.resource) {
    if (Array.isArray(query.resource)) {
      where.resource = { in: query.resource }
    } else {
      where.resource = query.resource
    }
  }

  if (query.resourceId) {
    where.resourceId = query.resourceId
  }

  if (query.status) {
    where.status = query.status
  }

  if (query.startDate || query.endDate) {
    where.timestamp = {}
    if (query.startDate) {
      where.timestamp.gte = query.startDate
    }
    if (query.endDate) {
      where.timestamp.lte = query.endDate
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs,
    total,
    hasMore: (query.offset || 0) + (query.limit || 100) < total,
  }
}

