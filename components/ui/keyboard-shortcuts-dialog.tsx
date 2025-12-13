'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X, Keyboard } from 'lucide-react'
import { Button } from './button'
import { formatShortcut, SHORTCUTS } from '@/hooks/use-keyboard-shortcuts'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const shortcutGroups = [
  {
    title: 'Navigation',
    shortcuts: [
      { ...SHORTCUTS.SEARCH, action: 'Focus search' },
      { ...SHORTCUTS.NEXT_MARKET, action: 'Select next market' },
      { ...SHORTCUTS.PREV_MARKET, action: 'Select previous market' },
      { ...SHORTCUTS.CLOSE, action: 'Close panel / dialog' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { ...SHORTCUTS.REFRESH, action: 'Refresh markets data' },
      { ...SHORTCUTS.SETTINGS, action: 'Open settings' },
      { ...SHORTCUTS.HELP, action: 'Show this help' },
    ],
  },
]

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <Dialog.Title className="text-xl font-semibold">
                Keyboard Shortcuts
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50"
                    >
                      <span className="text-sm">{shortcut.action}</span>
                      <kbd className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-mono">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">?</kbd> anytime to show this dialog
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}




