'use client'

import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-4 right-4 z-[9999] flex max-h-screen w-full flex-col gap-2 p-0 sm:max-w-[380px]',
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-stretch justify-between overflow-hidden rounded-2xl border bg-[#0e0f11]/90 backdrop-blur-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full duration-500',
  {
    variants: {
      variant: {
        default: 'border-white/10 text-white',
        success: 'border-emerald-500/40 shadow-emerald-500/10',
        error: 'border-red-500/40 shadow-red-500/10',
        warning: 'border-amber-500/40 shadow-amber-500/10',
        info: 'border-blue-500/40 shadow-blue-500/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants>
>(({ className, variant = 'default', children, ...props }, ref) => {
  const Icon = variantIcons[variant || 'default'];

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {/* Icon/Accent Strip */}
      <div className={cn(
        "w-12 flex items-center justify-center shrink-0 border-r border-white/5",
        variant === 'success' ? "bg-emerald-500/20" :
          variant === 'error' ? "bg-red-500/20" :
            variant === 'warning' ? "bg-amber-500/20" :
              variant === 'info' ? "bg-blue-500/20" :
                "bg-white/5"
      )}>
        {Icon && React.createElement(Icon, {
          className: cn(
            "w-5 h-5",
            variant === 'success' ? "text-emerald-400" :
              variant === 'error' ? "text-red-400" :
                variant === 'warning' ? "text-amber-400" :
                  variant === 'info' ? "text-blue-400" :
                    "text-gray-400"
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 pr-10">
        {children}
      </div>

      <ToastClose />
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold ring-offset-background transition-all hover:bg-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-white',
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-lg p-1.5 text-white/30 opacity-0 transition-all hover:text-white hover:bg-white/5 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-bold tracking-tight text-white mb-0.5', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-xs font-medium text-gray-400 leading-relaxed', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

// Icon mapping for variants
const variantIcons = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  variantIcons,
}












