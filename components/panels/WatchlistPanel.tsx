'use client'

import { useState } from 'react'
import { Market } from '@/types/market'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WatchlistItem, useWatchlist } from '@/hooks/use-watchlist'
import { Star, Trash2, X, ChevronUp, ChevronDown, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/hooks/use-toast'

interface WatchlistPanelProps {
  markets: Market[]
  onMarketSelect: (market: Market) => void
  isOpen: boolean
  onClose: () => void
}

export function WatchlistPanel({ 
  markets, 
  onMarketSelect,
  isOpen,
  onClose 
}: WatchlistPanelProps) {
  const { 
    watchlist, 
    getWatchlistMarkets, 
    removeFromWatchlist,
    updateNotes,
    clearWatchlist,
  } = useWatchlist()

  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const watchlistMarkets = getWatchlistMarkets(markets)

  const handleRemove = (market: Market) => {
    removeFromWatchlist(market.id, market.platform)
    toast.info('Removed from watchlist', market.title.slice(0, 40) + '...')
  }

  const handleEditNote = (item: WatchlistItem) => {
    setEditingNote(`${item.marketId}-${item.platform}`)
    setNoteText(item.notes || '')
  }

  const handleSaveNote = (market: Market) => {
    updateNotes(market.id, market.platform, noteText)
    setEditingNote(null)
    setNoteText('')
    toast.success('Note saved')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
            <h2 className="text-lg font-semibold">Watchlist</h2>
            <span className="text-sm text-muted-foreground">
              ({watchlistMarkets.length} markets)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {watchlist.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearWatchlist()
                  toast.info('Watchlist cleared')
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {watchlistMarkets.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium mb-2">No markets in watchlist</h3>
              <p className="text-sm text-muted-foreground">
                Click the star icon on any market to add it to your watchlist
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlistMarkets.map(market => {
                const item = watchlist.find(
                  w => w.marketId === market.id && w.platform === market.platform
                )
                const key = `${market.id}-${market.platform}`
                const isExpanded = expandedNote === key
                const isEditing = editingNote === key

                return (
                  <Card 
                    key={key}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-yellow-400 hover:text-yellow-500"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemove(market)
                          }}
                        >
                          <Star className="h-5 w-5 fill-current" />
                        </Button>

                        <div 
                          className="flex-1 min-w-0"
                          onClick={() => {
                            onMarketSelect(market)
                            onClose()
                          }}
                        >
                          <h3 className="font-medium line-clamp-2 text-sm">
                            {market.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                              market.platform === 'polymarket' 
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-green-500/20 text-green-400"
                            )}>
                              {market.platform}
                            </span>
                            {market.price !== undefined && (
                              <span className={cn(
                                "text-sm font-semibold",
                                market.price > 0.7 ? "text-green-400" :
                                market.price < 0.3 ? "text-red-400" : "text-foreground"
                              )}>
                                {(market.price * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (item?.notes || isExpanded) {
                                setExpandedNote(isExpanded ? null : key)
                              } else {
                                handleEditNote(item!)
                              }
                            }}
                          >
                            <StickyNote className={cn(
                              "h-4 w-4",
                              item?.notes ? "text-yellow-400" : "text-muted-foreground"
                            )} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedNote(isExpanded ? null : key)
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded notes section */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add a note..."
                                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingNote(null)
                                    setNoteText('')
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNote(market)}
                                >
                                  Save Note
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {item?.notes ? (
                                <div className="space-y-2">
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {item.notes}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditNote(item)}
                                  >
                                    Edit Note
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditNote(item!)}
                                  className="text-muted-foreground"
                                >
                                  <StickyNote className="h-4 w-4 mr-1" />
                                  Add Note
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Watchlist toggle button for market cards
export function WatchlistButton({ 
  market, 
  size = 'default',
  showLabel = false 
}: { 
  market: Market
  size?: 'sm' | 'default'
  showLabel?: boolean
}) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist()
  const isWatched = isInWatchlist(market.id, market.platform)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isWatched) {
      removeFromWatchlist(market.id, market.platform)
      toast.info('Removed from watchlist')
    } else {
      addToWatchlist(market)
      toast.success('Added to watchlist')
    }
  }

  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'icon' : 'default'}
      onClick={handleClick}
      className={cn(
        size === 'sm' ? 'h-7 w-7' : 'h-9',
        isWatched ? 'text-yellow-400 hover:text-yellow-500' : 'text-muted-foreground hover:text-yellow-400'
      )}
    >
      <Star className={cn(
        size === 'sm' ? 'h-4 w-4' : 'h-5 w-5',
        isWatched && 'fill-current'
      )} />
      {showLabel && (
        <span className="ml-1">{isWatched ? 'Watching' : 'Watch'}</span>
      )}
    </Button>
  )
}



