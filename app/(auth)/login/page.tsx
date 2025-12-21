'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Globe, TrendingUp, Zap } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  // Check for OAuth errors
  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'Callback') {
      toast.error(
        'OAuth login failed',
        'Database connection error. Please check DATABASE_URL in your .env file. See DATABASE_CONNECTION_FIX.md for help.'
      )
    }
  }, [searchParams])


  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/20 via-background to-background">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-0.5 mb-8">
            <span className="font-serif text-3xl italic font-bold text-foreground tracking-tight">Edge</span>
            <span className="font-sans text-3xl font-bold text-foreground tracking-tighter">Pannel</span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
            Prediction Markets<br />
            <span className="text-primary">Visualized</span>
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-md">
            Track and trade prediction markets from Polymarket and Kalshi on an interactive 3D globe.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="font-medium">Real-time Data</div>
                <div className="text-sm text-muted-foreground">Live prices from multiple platforms</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Globe className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <div className="font-medium">Global View</div>
                <div className="text-sm text-muted-foreground">See markets on an interactive globe</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <div className="font-medium">Fast Trading</div>
                <div className="text-sm text-muted-foreground">Execute trades directly from the app</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-0.5 mb-8">
            <span className="font-serif text-2xl italic font-bold text-foreground tracking-tight">Edge</span>
            <span className="font-sans text-2xl font-bold text-foreground tracking-tighter">Pannel</span>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in with your preferred social account</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await signIn('google', {
                    callbackUrl: '/edge',
                    redirect: true,
                  })
                } catch (error) {
                  console.error('Google sign-in error:', error)
                  toast.error('Google sign-in failed', 'Please try again')
                }
              }}
<<<<<<< HEAD
              className="gap-3 h-12 text-base"
              size="lg"
=======
              className="flex items-center justify-center"
>>>>>>> 9532797ba42f0277ee94b4759acdbad08287132c
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
<<<<<<< HEAD
              Continue with Google
=======
>>>>>>> 9532797ba42f0277ee94b4759acdbad08287132c
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await signIn('twitter', {
                    callbackUrl: '/edge',
                    redirect: true,
                  })
                } catch (error) {
                  console.error('Twitter/X sign-in error:', error)
                  toast.error('X sign-in failed', 'Please try again')
                }
              }}
<<<<<<< HEAD
              className="gap-3 h-12 text-base"
              size="lg"
=======
              className="flex items-center justify-center"
>>>>>>> 9532797ba42f0277ee94b4759acdbad08287132c
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
<<<<<<< HEAD
              Continue with X
=======
>>>>>>> 9532797ba42f0277ee94b4759acdbad08287132c
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground px-8">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}


