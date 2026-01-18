/**
 * Conflict/OSINT Data Validation Schemas
 */

import { z } from 'zod'
import { BoundingBoxSchema, PaginationSchema } from './common'

/**
 * OSINT Query Schema
 */
export const OSINTQuerySchema = z
  .object({
    country: z.string().trim().length(2).toUpperCase().optional(), // ISO country code
    region: z.string().trim().max(100).optional(),
    conflictType: z
      .enum([
        'armed_conflict',
        'political_unrest',
        'terrorism',
        'cyberattack',
        'natural_disaster',
        'economic_crisis',
        'all',
      ])
      .optional()
      .default('all'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    verified: z
      .union([z.boolean(), z.literal('true'), z.literal('false')])
      .transform((val) => (typeof val === 'string' ? val === 'true' : val))
      .optional(),
  })
  .merge(BoundingBoxSchema.partial())
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
 * Conflict Event Create Schema
 */
export const ConflictEventCreateSchema = z.object({
  title: z.string().trim().min(10).max(200),
  description: z.string().trim().min(20).max(2000),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    country: z.string().length(2).toUpperCase(),
    region: z.string().trim().max(100).optional(),
  }),
  type: z.enum([
    'armed_conflict',
    'political_unrest',
    'terrorism',
    'cyberattack',
    'natural_disaster',
    'economic_crisis',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  sources: z.array(z.string().url()).min(1).max(10),
  verified: z.boolean().default(false),
  casualties: z
    .object({
      deaths: z.number().int().min(0).optional(),
      injured: z.number().int().min(0).optional(),
      missing: z.number().int().min(0).optional(),
    })
    .optional(),
  tags: z.array(z.string().trim().max(50)).max(10).optional(),
})
