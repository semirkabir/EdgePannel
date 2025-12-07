import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db/client"
import { supabase } from "@/lib/supabase/client"

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

        try {
          // Authenticate with Supabase Auth
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          })

          if (authError || !authData?.user) {
            console.error('Supabase Auth error:', authError)
            return null
          }

          // Get user from Prisma to ensure consistency
          let user = await prisma.user.findUnique({
            where: { id: authData.user.id }
          })

          // If user doesn't exist in Prisma yet, create it (for backward compatibility)
          if (!user) {
            user = await prisma.user.create({
              data: {
                id: authData.user.id,
                email: authData.user.email!,
                name: authData.user.user_metadata?.name || authData.user.email!.split('@')[0],
                emailVerified: authData.user.email_confirmed_at ? new Date(authData.user.email_confirmed_at) : null,
                image: authData.user.user_metadata?.avatar_url,
              },
            })
          }

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
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}



