// Direct database authentication using Supabase PostgREST
// This works even when Prisma can't connect

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin, getSupabaseAdmin } from '@/lib/supabase/client'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Use Supabase PostgREST with service role key (bypasses RLS)
    // This works even when Prisma can't connect
    try {
      let supabaseClient;
      
      // Try to use admin client if available
      if (supabaseAdmin) {
        supabaseClient = supabaseAdmin;
      } else {
        // Fallback: try to get admin client
        try {
          supabaseClient = getSupabaseAdmin();
        } catch {
          // If no service role key, use regular client (might have RLS restrictions)
          const { supabase } = await import('@/lib/supabase/client');
          supabaseClient = supabase;
        }
      }

      // Query user from database using Supabase PostgREST
      // maybeSingle() returns a single object or null, not an array
      const { data: user, error: queryError } = await supabaseClient
        .from('User')
        .select('id, email, name, password, image')
        .eq('email', email)
        .limit(1)
        .maybeSingle()

      if (queryError) {
        console.error('Supabase query error:', queryError)
        return NextResponse.json(
          { 
            error: 'Database query failed',
            details: process.env.NODE_ENV === 'development' ? queryError.message : undefined
          },
          { status: 503 }
        )
      }

      if (!user || !user.password) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        )
      }

      // Verify password with bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password)

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
      })
    } catch (dbError: any) {
      console.error('Database authentication failed:', dbError.message)
      return NextResponse.json(
        { 
          error: 'Database connection failed',
          details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
        },
        { status: 503 }
      )
    }
  } catch (error: any) {
    console.error('Verify credentials error:', error)
    return NextResponse.json(
      { error: 'Failed to verify credentials' },
      { status: 500 }
    )
  }
}

