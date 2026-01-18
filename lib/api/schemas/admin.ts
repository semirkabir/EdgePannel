/**
 * Admin API Validation Schemas
 */

import { z } from 'zod'
import { PaginationSchema } from './common'

/**
 * Admin Stats Query Schema
 */
export const AdminStatsQuerySchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d', 'all']).optional().default('7d'),
  includeDetails: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val))
    .optional()
    .default(false),
})

/**
 * Audit Logs Query Schema
 */
export const AuditLogsQuerySchema = z
  .object({
    userId: z.string().uuid().optional(),
    action: z
      .enum(['create', 'update', 'delete', 'login', 'logout', 'api_key_create', 'api_key_delete', 'settings_update'])
      .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  })
  .merge(PaginationSchema)
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate
      }
      return true
    },
    { message: 'Start date must be before end date' }
  )

/**
 * Clear Geotagged Markets Schema
 */
export const ClearGeotaggedSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Must confirm deletion by setting confirm=true' }),
  }),
  reason: z.string().trim().min(10).max(500),
})

/**
 * User Management Schema
 */
export const UserManagementQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    role: z.enum(['user', 'admin', 'moderator']).optional(),
    status: z.enum(['active', 'suspended', 'deleted']).optional(),
    hasApiKeys: z
      .union([z.boolean(), z.literal('true'), z.literal('false')])
      .transform((val) => (typeof val === 'string' ? val === 'true' : val))
      .optional(),
  })
  .merge(PaginationSchema)

/**
 * System Settings Update Schema
 */
export const SystemSettingsUpdateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  allowRegistration: z.boolean().optional(),
  maxApiKeysPerUser: z.number().int().min(1).max(10).optional(),
  sessionTimeout: z.number().int().min(300).max(86400).optional(), // 5 min to 24 hours
  rateLimit: z
    .object({
      enabled: z.boolean(),
      requestsPerMinute: z.number().int().min(10).max(1000),
    })
    .optional(),
})
