import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import TwitterProvider from "next-auth/providers/twitter"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db/client"
import { verifyPassword, recordFailedAttempt, clearFailedAttempts, isAccountLocked } from "@/lib/auth/security"
import { auditLog } from "@/lib/audit/audit-logger"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // AUTO-CREATE TEST USER CHECK
        // If logging in with test credentials, ensure the user exists
        if (credentials.email === 'test@example.com' && credentials.password === 'testpassword123') {
          try {
            const exists = await prisma.user.findUnique({ where: { email: credentials.email } })
            if (!exists) {
              console.log('[Auth] Auto-creating test user...')
              const hashedPassword = await import('@/lib/auth/security').then(m => m.hashPassword(credentials.password))
              await prisma.user.create({
                data: {
                  email: credentials.email,
                  name: 'Test User',
                  password: hashedPassword,
                  emailVerified: new Date(),
                }
              })
              console.log('[Auth] Test user created')
            }
          } catch (error) {
            console.error('[Auth] Failed to auto-create test user:', error)
          }
        }

        try {
          // Check for account lockout (use email as identifier)
          if (isAccountLocked(credentials.email)) {
            // Don't reveal lockout status - return null like invalid credentials
            return null
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })

          if (!user || !user.password) {
            // User doesn't exist or doesn't have a password (OAuth-only user)
            // Record failed attempt to prevent user enumeration
            recordFailedAttempt(credentials.email)
            return null
          }

          // Verify password with bcrypt
          const isPasswordValid = await verifyPassword(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            // Record failed attempt
            const lockoutStatus = recordFailedAttempt(credentials.email)

            // Log lockout warning (but don't reveal to user)
            if (lockoutStatus.isLocked) {
              console.warn(`[Auth] Account locked for ${credentials.email} until ${new Date(lockoutStatus.lockedUntil!).toISOString()}`)
            }

            // Audit log failed login
            await auditLog({
              userId: user.id,
              action: 'LOGIN_FAILED',
              resource: 'user',
              resourceId: user.id,
              status: 'FAILURE',
              details: {
                email: credentials.email,
                locked: lockoutStatus.isLocked,
              },
            })

            return null
          }

          // Successful login - clear failed attempts
          clearFailedAttempts(credentials.email)

          // Audit log successful login
          await auditLog({
            userId: user.id,
            action: 'LOGIN',
            resource: 'user',
            resourceId: user.id,
            status: 'SUCCESS',
            details: {
              email: credentials.email,
            },
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          console.error('NextAuth authorize error:', error)
          // Return null on errors to prevent exposing connection issues
          return null
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      version: "2.0", // Use OAuth 2.0 (X's current standard)
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign-ins, but log OAuth sign-ins
      if (account?.provider && account.provider !== 'credentials') {
        try {
          // Find or create user for audit logging
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email || '' },
          })

          if (dbUser) {
            await auditLog({
              userId: dbUser.id,
              action: 'LOGIN',
              resource: 'user',
              resourceId: dbUser.id,
              status: 'SUCCESS',
              details: {
                provider: account.provider,
                email: user.email,
              },
            })
          }
        } catch (error) {
          console.error('[Auth] Error logging OAuth sign-in:', error)
          // Don't block sign-in if audit logging fails
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      if (account) {
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        // @ts-ignore - Add provider to session for debugging
        session.provider = token.provider
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}



