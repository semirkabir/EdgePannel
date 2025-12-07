import { createClient } from '@supabase/supabase-js'

// Supabase project URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://onwkzqbrmrskazfitshr.supabase.co'

// For server-side operations (creating users, admin operations)
// Use service role key for admin operations
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// For client-side operations (authentication)
// Use anon key for public operations
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ud2t6cWJybXJza2F6Zml0c2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjEzMjgsImV4cCI6MjA3OTkzNzMyOH0.x71N9NtBo0QoRC52AyNUpCfTacuVP60BhJ4HhLW0R84'

// Server-side Supabase client with service role (for admin operations)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

// Client-side Supabase client (for user authentication)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper to get Supabase client for server-side operations
export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your .env file.')
  }
  return supabaseAdmin
}

