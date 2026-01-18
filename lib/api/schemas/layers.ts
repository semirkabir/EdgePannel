/**
 * Map Layers API Validation Schemas
 */

import { z } from 'zod'
import { BoundingBoxSchema } from './common'

/**
 * Census Data Query Schema
 */
export const CensusDataQuerySchema = z
  .object({
    state: z.string().trim().length(2).toUpperCase().optional(), // State code (e.g., "CA")
    county: z.string().trim().max(100).optional(),
    variable: z
      .enum([
        'population',
        'income',
        'poverty',
        'education',
        'unemployment',
        'housing',
        'all',
      ])
      .optional()
      .default('all'),
    year: z.coerce.number().int().min(2010).max(2030).optional(),
  })
  .merge(BoundingBoxSchema.partial())

/**
 * Finance Layer Query Schema
 */
export const FinanceLayerQuerySchema = z
  .object({
    type: z.enum(['banks', 'exchanges', 'atms', 'financial_centers']).optional(),
    minValue: z.coerce.number().min(0).optional(),
    radius: z.coerce.number().min(1).max(100).optional(), // km
  })
  .merge(BoundingBoxSchema)

/**
 * News Layer Query Schema
 */
export const NewsLayerQuerySchema = z
  .object({
    source: z
      .enum(['gdelt', 'reuters', 'bloomberg', 'ap', 'all'])
      .optional()
      .default('all'),
    categories: z
      .string()
      .transform((val) => val.split(',').map((c) => c.trim()))
      .pipe(z.array(z.string()).max(10))
      .optional(),
    tone: z.enum(['positive', 'negative', 'neutral', 'all']).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .merge(BoundingBoxSchema)
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
 * Custom Layer Create Schema
 */
export const CustomLayerCreateSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  type: z.enum(['point', 'polygon', 'line', 'heatmap']),
  data: z.array(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      properties: z.record(z.unknown()).optional(),
    })
  ),
  style: z
    .object({
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      opacity: z.number().min(0).max(1),
      weight: z.number().min(0).max(10).optional(),
      fillColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      fillOpacity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  visibility: z.enum(['public', 'private']).default('private'),
})

/**
 * Custom Layer Update Schema
 */
export const CustomLayerUpdateSchema = CustomLayerCreateSchema.partial().extend({
  layerId: z.string().uuid(),
})

/**
 * Custom Layer Query Schema
 */
export const CustomLayerQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  visibility: z.enum(['public', 'private', 'all']).optional().default('all'),
  type: z.enum(['point', 'polygon', 'line', 'heatmap', 'all']).optional(),
})
