'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Globe, Check, Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding (same as login) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary/20 via-background to-background">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-0.5 mb-8">
            <span className="font-serif text-3xl italic font-bold text-foreground tracking-tight">Edge</span>
            <span className="font-sans text-3xl font-bold text-foreground tracking-tighter">Pannel</span>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
            Start Trading<br />
            <span className="text-primary">Predictions</span>
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-md">
            Join thousands of traders using EdgePannel to discover and trade on prediction markets.
          </p>

          {/* Benefits */}
          <div className="space-y-3">
            {[
              'Connect your own API keys',
              'Real-time market data',
              'Trade on multiple platforms',
              'Visual analytics on a 3D globe',
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-400" />
                </div>
                <span className="text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Register form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
<<<<<<< HEAD
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">EdgePannel</h1>
=======
          <div className="lg:hidden flex items-center justify-center gap-0.5 mb-6">
            <span className="font-serif text-2xl italic font-bold text-foreground tracking-tight">Edge</span>
            <span className="font-sans text-2xl font-bold text-foreground tracking-tighter">Pannel</span>
>>>>>>> 9532797ba42f0277ee94b4759acdbad08287132c
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="text-muted-foreground mt-2">Get started with EdgePannel today using your favorite platform</p>
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
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
<<<<<<< HEAD
              Sign up with Google
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
              Sign up with X
=======
>>>>>>> 9532797ba42f0277ee94b4759acdbad08287132c
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground px-8">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}


