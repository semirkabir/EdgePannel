import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Gracefully disconnect on process exit to avoid stale connections
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

/**
 * Wrapper function to handle prepared statement errors with retry logic
 * This helps with Supabase connection pooling issues
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error

      // Check if it's a prepared statement error
      if (error?.code === 'P2034' || error?.message?.includes('prepared statement') || error?.message?.includes('26000')) {
        console.warn(`[DB] Prepared statement error, retrying (${i + 1}/${maxRetries})...`)

        // Disconnect and reconnect to refresh the connection
        await prisma.$disconnect()
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))) // Exponential backoff
        continue
      }

      // If it's not a prepared statement error, throw immediately
      throw error
    }
  }

  throw lastError || new Error('Max retries exceeded')
}



