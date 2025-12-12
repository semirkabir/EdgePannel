import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import TwitterProvider from "next-auth/providers/twitter"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db/client"
import { supabase, supabaseAdmin } from "@/lib/supabase/client"
import bcrypt from "bcryptjs"

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
          // First, try Supabase Auth (for users created via Supabase)
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          })

          if (!authError && authData?.user) {
            // User authenticated via Supabase Auth
            try {
              let user = await prisma.user.findUnique({
                where: { id: authData.user.id }
              })

              // If user doesn't exist in Prisma yet, create it
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
            } catch (prismaError: any) {
              // If Prisma fails, return user from Supabase Auth directly
              console.warn('Prisma connection failed, using Supabase Auth user:', prismaError.message)
              return {
                id: authData.user.id,
                email: authData.user.email!,
                name: authData.user.user_metadata?.name || authData.user.email!.split('@')[0],
                image: authData.user.user_metadata?.avatar_url,
              }
            }
          }

          // Fallback: Try Prisma with bcrypt (for users created without Supabase)
          try {
            const user = await prisma.user.findUnique({
              where: { email: credentials.email }
            })

            if (!user || !user.password) {
              // User doesn't exist or doesn't have a password (OAuth-only user)
              return null
            }

            // Verify password with bcrypt
            const isPasswordValid = await bcrypt.compare(
              credentials.password,
              user.password
            )

            if (!isPasswordValid) {
              return null
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            }
          } catch (prismaError: any) {
            // Prisma connection failed - try using Supabase PostgREST client directly
            console.warn('Prisma connection failed, trying Supabase PostgREST:', prismaError.message)
            
            // Check if it's a connection error
            const isConnectionError = prismaError.message?.includes("Can't reach database server") ||
                                     prismaError.message?.includes("connection") ||
                                     prismaError.code === 'P1001'
            
            if (isConnectionError) {
              // Use Supabase PostgREST to query the database directly
              // This works even when Prisma can't connect
              try {
                const { data: users, error: queryError } = await supabase
                  .from('User')
                  .select('id, email, name, password, image')
                  .eq('email', credentials.email)
                  .limit(1)
                  .single()

                if (!queryError && users && users.password) {
                  const isPasswordValid = await bcrypt.compare(credentials.password, users.password)
                  
                  if (isPasswordValid) {
                    return {
                      id: users.id,
                      email: users.email,
                      name: users.name,
                      image: users.image,
                    }
                  }
                }
              } catch (supabaseError: any) {
                console.error('Supabase PostgREST query failed:', supabaseError.message)
                // If Supabase also fails, try the verify-direct API endpoint as last resort
                try {
                  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
                    ? `https://${process.env.VERCEL_URL}` 
                    : 'http://localhost:3000'
                  
                  const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-direct`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: credentials.email,
                      password: credentials.password,
                    }),
                  })

                  if (verifyResponse.ok) {
                    const userData = await verifyResponse.json()
                    if (userData.user) {
                      return {
                        id: userData.user.id,
                        email: userData.user.email,
                        name: userData.user.name,
                        image: userData.user.image,
                      }
                    }
                  }
                } catch (fetchError) {
                  console.error('API verification also failed:', fetchError)
                }
              }
            }

            // If all else fails, return null
            return null
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
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      version: "2.0", // Use OAuth 2.0 (X's current standard)
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



