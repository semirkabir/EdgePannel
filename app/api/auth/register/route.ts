import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { getSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth (this will appear in Authentication > Users)
    const supabaseAdmin = getSupabaseAdmin()
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name || email.split('@')[0],
      },
    })

    // Check if user already exists (Supabase returns specific error for duplicates)
    if (authError) {
      // Check if error is due to user already existing
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 400 }
        )
      }
      console.error('Supabase Auth error:', authError)
      return NextResponse.json(
        { error: authError.message || 'Failed to create user in Supabase Auth' },
        { status: 500 }
      )
    }

    if (!authUser?.user) {
      return NextResponse.json(
        { error: 'Failed to create user in Supabase Auth' },
        { status: 500 }
      )
    }

    // Also create user record in Prisma for compatibility with existing code
    try {
      const user = await prisma.user.create({
        data: {
          id: authUser.user.id, // Use Supabase Auth user ID
          name: name || authUser.user.user_metadata?.name || email.split('@')[0],
          email,
          emailVerified: authUser.user.email_confirmed_at ? new Date(authUser.user.email_confirmed_at) : null,
          // Don't store password - authentication is handled by Supabase Auth
        },
      })

      return NextResponse.json(
        { 
          message: 'User created successfully', 
          userId: user.id,
          supabaseUserId: authUser.user.id 
        },
        { status: 201 }
      )
    } catch (dbError: any) {
      // If Prisma creation fails, try to clean up Supabase Auth user
      console.error('Prisma error:', dbError)
      if (authUser.user.id) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      }
      return NextResponse.json(
        { error: 'Failed to create user record in database' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



