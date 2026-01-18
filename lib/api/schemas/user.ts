import { z } from 'zod'
import {
  PlatformSchema,
  EmailSchema,
  PasswordSchema,
  CurrencyCodeSchema,
} from './common'

/**
 * User-related validation schemas
 */

// User registration
export const RegistrationSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: EmailSchema,
  password: PasswordSchema,
})

// Email update
export const EmailUpdateSchema = z.object({
  newEmail: EmailSchema,
})

// Password update
export const PasswordUpdateSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: PasswordSchema,
})

// Password reset request
export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
})

// Password reset confirmation
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: PasswordSchema,
})

// Email verification
export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
})

// User preferences
export const UserPreferencesSchema = z.object({
  viewMode: z.enum(['map', 'globe', 'insights', 'agent']).optional(),
  autoRotate: z.boolean().optional(),
  rotationSpeed: z.number().min(0.1).max(10).optional(),
  pauseOnHover: z.boolean().optional(),
  showLabels: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
  defaultPlatform: z.enum(['kalshi', 'polymarket', 'all']).optional(),
  defaultCurrency: CurrencyCodeSchema,
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  autoRefresh: z.boolean().optional(),
  refreshInterval: z.number().int().min(5).max(300).optional(),
  displaySettings: z.object({
    showProbabilities: z.boolean().optional(),
    showVolume: z.boolean().optional(),
    showLiquidity: z.boolean().optional(),
    compactMode: z.boolean().optional(),
  }).optional(),
  tradingPreferences: z.object({
    defaultOrderType: z.enum(['market', 'limit']).optional(),
    confirmTrades: z.boolean().optional(),
    slippageTolerance: z.number().min(0).max(100).optional(),
  }).optional(),
}).passthrough()

// Update preferences body
export const UpdatePreferencesSchema = z.object({
  preferences: UserPreferencesSchema,
})

// Linked account body
export const LinkedAccountSchema = z.object({
  platform: PlatformSchema,
  accountId: z.string().trim().min(1).max(255),
  accessToken: z.string().trim().min(1).optional(),
})
