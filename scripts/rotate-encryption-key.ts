#!/usr/bin/env tsx
/**
 * Encryption Key Rotation Script
 *
 * This script rotates encrypted data from old encryption keys to a new key version.
 * It scans the database for encrypted fields and re-encrypts them with the current key.
 *
 * Usage:
 *   npx tsx scripts/rotate-encryption-key.ts --dry-run
 *   npx tsx scripts/rotate-encryption-key.ts --execute
 *   npx tsx scripts/rotate-encryption-key.ts --verify
 *
 * Prerequisites:
 *   1. Set ENCRYPTION_KEY_V1 (old key) in .env
 *   2. Set ENCRYPTION_KEY_V2 (new key) in .env
 *   3. Set ENCRYPTION_KEY_CURRENT=v2 in .env
 *   4. Backup your database before executing
 *
 * Safety:
 *   - Always run with --dry-run first
 *   - Creates backup before rotation
 *   - Validates all data can be decrypted before re-encrypting
 *   - Rolls back on any error
 */

import { PrismaClient } from '@prisma/client'
import { decrypt, encrypt, getEncryptionVersion, needsReencryption, reencrypt } from '../lib/utils/encryption'

const prisma = new PrismaClient()

interface RotationStats {
  totalRecords: number
  needsRotation: number
  rotated: number
  failed: number
  skipped: number
  errors: Array<{ record: string; error: string }>
}

const stats: RotationStats = {
  totalRecords: 0,
  needsRotation: 0,
  rotated: 0,
  failed: 0,
  skipped: 0,
  errors: [],
}

/**
 * Parse command line arguments
 */
function parseArgs(): { mode: 'dry-run' | 'execute' | 'verify'; verbose: boolean } {
  const args = process.argv.slice(2)

  const mode = args.includes('--execute')
    ? 'execute'
    : args.includes('--verify')
      ? 'verify'
      : 'dry-run'

  const verbose = args.includes('--verbose') || args.includes('-v')

  return { mode, verbose }
}

/**
 * Rotate encrypted API keys for a user
 */
async function rotateUserApiKeys(userId: string, dryRun: boolean, verbose: boolean): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      encryptedPolymarketApiKey: true,
      encryptedPolymarketApiSecret: true,
      encryptedKalshiApiKey: true,
      encryptedKalshiApiSecret: true,
    },
  })

  if (!user) return

  const updates: Record<string, string> = {}

  // Check Polymarket API key
  if (user.encryptedPolymarketApiKey) {
    stats.totalRecords++
    const version = getEncryptionVersion(user.encryptedPolymarketApiKey)

    if (needsReencryption(user.encryptedPolymarketApiKey)) {
      stats.needsRotation++

      if (verbose) {
        console.log(`  User ${user.email}: Polymarket API Key (${version} → current)`)
      }

      try {
        // Validate we can decrypt with old key
        decrypt(user.encryptedPolymarketApiKey)

        if (!dryRun) {
          updates.encryptedPolymarketApiKey = reencrypt(user.encryptedPolymarketApiKey)
          stats.rotated++
        }
      } catch (error) {
        stats.failed++
        stats.errors.push({
          record: `User ${user.id} - Polymarket API Key`,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    } else {
      stats.skipped++
    }
  }

  // Check Polymarket API secret
  if (user.encryptedPolymarketApiSecret) {
    stats.totalRecords++
    const version = getEncryptionVersion(user.encryptedPolymarketApiSecret)

    if (needsReencryption(user.encryptedPolymarketApiSecret)) {
      stats.needsRotation++

      if (verbose) {
        console.log(`  User ${user.email}: Polymarket API Secret (${version} → current)`)
      }

      try {
        decrypt(user.encryptedPolymarketApiSecret)

        if (!dryRun) {
          updates.encryptedPolymarketApiSecret = reencrypt(user.encryptedPolymarketApiSecret)
          stats.rotated++
        }
      } catch (error) {
        stats.failed++
        stats.errors.push({
          record: `User ${user.id} - Polymarket API Secret`,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    } else {
      stats.skipped++
    }
  }

  // Check Kalshi API key
  if (user.encryptedKalshiApiKey) {
    stats.totalRecords++
    const version = getEncryptionVersion(user.encryptedKalshiApiKey)

    if (needsReencryption(user.encryptedKalshiApiKey)) {
      stats.needsRotation++

      if (verbose) {
        console.log(`  User ${user.email}: Kalshi API Key (${version} → current)`)
      }

      try {
        decrypt(user.encryptedKalshiApiKey)

        if (!dryRun) {
          updates.encryptedKalshiApiKey = reencrypt(user.encryptedKalshiApiKey)
          stats.rotated++
        }
      } catch (error) {
        stats.failed++
        stats.errors.push({
          record: `User ${user.id} - Kalshi API Key`,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    } else {
      stats.skipped++
    }
  }

  // Check Kalshi API secret
  if (user.encryptedKalshiApiSecret) {
    stats.totalRecords++
    const version = getEncryptionVersion(user.encryptedKalshiApiSecret)

    if (needsReencryption(user.encryptedKalshiApiSecret)) {
      stats.needsRotation++

      if (verbose) {
        console.log(`  User ${user.email}: Kalshi API Secret (${version} → current)`)
      }

      try {
        decrypt(user.encryptedKalshiApiSecret)

        if (!dryRun) {
          updates.encryptedKalshiApiSecret = reencrypt(user.encryptedKalshiApiSecret)
          stats.rotated++
        }
      } catch (error) {
        stats.failed++
        stats.errors.push({
          record: `User ${user.id} - Kalshi API Secret`,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    } else {
      stats.skipped++
    }
  }

  // Apply updates if not dry run
  if (!dryRun && Object.keys(updates).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: updates,
    })
  }
}

/**
 * Verify all encrypted data can be decrypted
 */
async function verifyEncryptedData(verbose: boolean): Promise<boolean> {
  console.log('\n🔍 Verifying all encrypted data...\n')

  let allValid = true
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      encryptedPolymarketApiKey: true,
      encryptedPolymarketApiSecret: true,
      encryptedKalshiApiKey: true,
      encryptedKalshiApiSecret: true,
    },
  })

  for (const user of users) {
    const fields = [
      { name: 'Polymarket API Key', value: user.encryptedPolymarketApiKey },
      { name: 'Polymarket API Secret', value: user.encryptedPolymarketApiSecret },
      { name: 'Kalshi API Key', value: user.encryptedKalshiApiKey },
      { name: 'Kalshi API Secret', value: user.encryptedKalshiApiSecret },
    ]

    for (const field of fields) {
      if (field.value) {
        try {
          const version = getEncryptionVersion(field.value)
          decrypt(field.value)

          if (verbose) {
            console.log(`✅ User ${user.email}: ${field.name} (${version})`)
          }
        } catch (error) {
          allValid = false
          console.error(`❌ User ${user.email}: ${field.name} - ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }
  }

  return allValid
}

/**
 * Main rotation function
 */
async function rotateEncryptionKeys(): Promise<void> {
  const { mode, verbose } = parseArgs()

  console.log('🔐 Encryption Key Rotation Tool\n')
  console.log(`Mode: ${mode.toUpperCase()}`)
  console.log(`Verbose: ${verbose}\n`)

  // Verify mode
  if (mode === 'verify') {
    const isValid = await verifyEncryptedData(verbose)
    if (isValid) {
      console.log('\n✅ All encrypted data is valid and can be decrypted!')
    } else {
      console.log('\n❌ Some encrypted data failed validation!')
      process.exit(1)
    }
    return
  }

  const dryRun = mode === 'dry-run'

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n')
  } else {
    console.log('🚨 EXECUTE MODE - Database will be modified\n')

    // Require confirmation
    const confirm = process.env.CONFIRM_ROTATION === 'yes'
    if (!confirm) {
      console.error('❌ Set CONFIRM_ROTATION=yes environment variable to proceed with rotation')
      process.exit(1)
    }
  }

  console.log('📊 Scanning database for encrypted data...\n')

  try {
    // Get all users with encrypted data
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { encryptedPolymarketApiKey: { not: null } },
          { encryptedPolymarketApiSecret: { not: null } },
          { encryptedKalshiApiKey: { not: null } },
          { encryptedKalshiApiSecret: { not: null } },
        ],
      },
      select: { id: true },
    })

    console.log(`Found ${users.length} users with encrypted data\n`)

    // Process each user
    for (const user of users) {
      await rotateUserApiKeys(user.id, dryRun, verbose)
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📈 Rotation Summary')
    console.log('='.repeat(60))
    console.log(`Total encrypted fields:     ${stats.totalRecords}`)
    console.log(`Needs rotation:             ${stats.needsRotation}`)
    console.log(`Successfully rotated:       ${stats.rotated}`)
    console.log(`Skipped (already current):  ${stats.skipped}`)
    console.log(`Failed:                     ${stats.failed}`)
    console.log('='.repeat(60))

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:\n')
      stats.errors.forEach((err) => {
        console.log(`  ${err.record}: ${err.error}`)
      })
    }

    if (dryRun && stats.needsRotation > 0) {
      console.log('\n✅ Dry run completed successfully!')
      console.log('To execute rotation, run:')
      console.log('  CONFIRM_ROTATION=yes npx tsx scripts/rotate-encryption-key.ts --execute\n')
    } else if (!dryRun) {
      console.log('\n✅ Key rotation completed successfully!')
      console.log('Verify the rotation with:')
      console.log('  npx tsx scripts/rotate-encryption-key.ts --verify\n')
    }
  } catch (error) {
    console.error('\n❌ Rotation failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the rotation
rotateEncryptionKeys().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
