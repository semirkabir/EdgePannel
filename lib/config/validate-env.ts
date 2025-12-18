/**
 * Environment variable validation
 * Import this file at the top of your entry point to validate env vars at startup
 * 
 * Usage in app/layout.tsx or app/page.tsx:
 * import '@/lib/config/validate-env'
 */

import { env } from './env'

// Export env for use throughout the app
export { env }

// Log successful validation (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('✅ Environment variables validated successfully')
}

