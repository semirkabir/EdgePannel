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



