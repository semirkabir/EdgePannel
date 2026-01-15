import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import TwitterProvider from "next-auth/providers/twitter"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db/client"
import { auditLog } from "@/lib/audit/audit-logger"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      version: "2.0", // Use OAuth 2.0 (X's current standard)
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "users.read tweet.read offline.access email",
          // Don't force login if user is already authenticated to X
          force_login: "false",
          // Use screen_name for better UX (auto-fills username if logged in)
          screen_name: "",
        },
      },
      profile(profile) {
        return {
          id: profile.data.id,
          name: profile.data.name,
          email: profile.data.email ?? null,
          image: profile.data.profile_image_url,
        }
      },
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
          console.log('[Auth] OAuth sign-in attempt:', {
            provider: account.provider,
            email: user.email,
            userId: user.id,
          })

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
          } else {
            console.log('[Auth] User not found in database, will be created by adapter:', user.email)
          }
        } catch (error) {
          console.error('[Auth] Error during OAuth sign-in callback:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            provider: account.provider,
            email: user.email,
          })
          // Don't block sign-in if audit logging fails
          // The user account creation is handled by the Prisma adapter
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



