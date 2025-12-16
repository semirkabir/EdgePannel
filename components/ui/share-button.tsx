'use client'

import { useState } from 'react'
import { Market } from '@/types/market'
import { Button } from '@/components/ui/button'
import { Share2, Copy, Check, Twitter, ExternalLink, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils/cn'

interface ShareButtonProps {
  market: Market
  size?: 'sm' | 'default'
  variant?: 'ghost' | 'outline' | 'default'
}

export function ShareButton({ market, size = 'default', variant = 'ghost' }: ShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  // Generate share URL
  const getShareUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/dashboard?market=${market.id}&platform=${market.platform}`
  }

  // Generate share text
  const getShareText = () => {
    const price = market.price !== undefined ? ` (${(market.price * 100).toFixed(0)}%)` : ''
    return `${market.title}${price} - Track this prediction market on EdgePannel`
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl())
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  const handleShareTwitter = () => {
    const text = getShareText()
    const url = getShareUrl()
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(twitterUrl, '_blank', 'width=550,height=420')
    setShowMenu(false)
  }

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: market.title,
          text: getShareText(),
          url: getShareUrl(),
        })
      } catch (error) {
        // User cancelled or share failed
      }
    }
    setShowMenu(false)
  }

  const handleOpenExternal = () => {
    if (market.rawData?.url) {
      window.open(market.rawData.url, '_blank')
    } else {
      // Construct URL based on platform
      const url = market.platform === 'polymarket'
        ? `https://polymarket.com/event/${market.id}`
        : `https://kalshi.com/markets/${market.id}`
      window.open(url, '_blank')
    }
    setShowMenu(false)
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size={size === 'sm' ? 'icon' : 'default'}
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className={cn(
          size === 'sm' ? 'h-7 w-7' : 'h-9',
          'text-muted-foreground hover:text-foreground'
        )}
      >
        <Share2 className={cn(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')} />
      </Button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)} 
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-background border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-1">
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>

              <button
                onClick={handleShareTwitter}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <Twitter className="h-4 w-4" />
                Share on X
              </button>

              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleShareNative}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  Share...
                </button>
              )}

              <div className="h-px bg-border my-1" />

              <button
                onClick={handleOpenExternal}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View on {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}







