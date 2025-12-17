'use client'

import { useState } from 'react'
import { Market } from '@/types/market'
import { Button } from '@/components/ui/button'
import { usePriceAlerts, AlertCondition, PriceAlert } from '@/hooks/use-price-alerts'
import { Bell, BellOff, Trash2, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/hooks/use-toast'

interface CreateAlertDialogProps {
  market: Market
  isOpen: boolean
  onClose: () => void
}

export function CreateAlertDialog({ market, isOpen, onClose }: CreateAlertDialogProps) {
  const { createAlert, getAlertsForMarket, removeAlert } = usePriceAlerts()
  const [targetPrice, setTargetPrice] = useState(
    market.price !== undefined ? Math.round(market.price * 100) : 50
  )
  const [condition, setCondition] = useState<AlertCondition>('above')

  const existingAlerts = getAlertsForMarket(market.id, market.platform)
  const currentPrice = market.price !== undefined ? market.price * 100 : null

  const handleCreate = () => {
    createAlert(market, targetPrice, condition)
    toast.success('Alert created', `You'll be notified when price goes ${condition} ${targetPrice}%`)
    setTargetPrice(currentPrice !== null ? Math.round(currentPrice) : 50)
    setCondition('above')
  }

  const handleRemoveAlert = (alert: PriceAlert) => {
    removeAlert(alert.id)
    toast.info('Alert removed')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Price Alerts</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Market info */}
        <div className="p-4 bg-muted/50 border-b border-border">
          <h3 className="font-medium line-clamp-2 text-sm">{market.title}</h3>
          {currentPrice !== null && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Current:</span>
              <span className={cn(
                "font-semibold",
                currentPrice > 70 ? "text-green-400" :
                currentPrice < 30 ? "text-red-400" : "text-foreground"
              )}>
                {currentPrice.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Create new alert */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Alert when price</label>
            <div className="flex gap-2">
              {(['above', 'below', 'crosses'] as const).map(cond => (
                <Button
                  key={cond}
                  variant={condition === cond ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCondition(cond)}
                  className="flex-1 capitalize"
                >
                  {cond}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Target Price: {targetPrice}%</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="99"
                value={targetPrice}
                onChange={(e) => setTargetPrice(parseInt(e.target.value))}
                className="flex-1 accent-primary"
              />
              <input
                type="number"
                min="1"
                max="99"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Math.max(1, Math.min(99, parseInt(e.target.value) || 50)))}
                className="w-16 px-2 py-1 bg-background border border-input rounded-md text-center text-sm"
              />
            </div>
          </div>

          <Button onClick={handleCreate} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Create Alert
          </Button>
        </div>

        {/* Existing alerts */}
        {existingAlerts.length > 0 && (
          <div className="p-4 border-t border-border">
            <h4 className="text-sm font-medium mb-3">Active Alerts</h4>
            <div className="space-y-2">
              {existingAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg",
                    alert.triggered ? "bg-green-500/10" : "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {alert.triggered ? (
                      <BellOff className="h-4 w-4 text-green-400" />
                    ) : (
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {alert.condition === 'crosses' ? 'Crosses' : alert.condition === 'above' ? '≥' : '≤'}{' '}
                      <strong>{alert.targetPrice}%</strong>
                    </span>
                    {alert.triggered && (
                      <span className="text-xs text-green-400">✓ Triggered</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    onClick={() => handleRemoveAlert(alert)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Alert button for market cards
export function AlertButton({ 
  market, 
  size = 'default' 
}: { 
  market: Market
  size?: 'sm' | 'default' 
}) {
  const [showDialog, setShowDialog] = useState(false)
  const { getAlertsForMarket } = usePriceAlerts()
  const alertCount = getAlertsForMarket(market.id, market.platform).filter(a => !a.triggered).length

  return (
    <>
      <Button
        variant="ghost"
        size={size === 'sm' ? 'icon' : 'default'}
        onClick={(e) => {
          e.stopPropagation()
          setShowDialog(true)
        }}
        className={cn(
          size === 'sm' ? 'h-7 w-7' : 'h-9',
          alertCount > 0 ? 'text-primary' : 'text-muted-foreground hover:text-primary'
        )}
      >
        <div className="relative">
          <Bell className={cn(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5')} />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full text-[8px] font-bold flex items-center justify-center text-primary-foreground">
              {alertCount}
            </span>
          )}
        </div>
      </Button>
      
      <CreateAlertDialog
        market={market}
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
      />
    </>
  )
}











