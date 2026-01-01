'use client'

import React, { useState } from 'react'
import { BookOpen, X, Trash2, Pin, Sparkles, Send, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useResearchStore } from '@/hooks/use-research-store'

interface ResearchNotebookProps {
    isOpen: boolean
    onClose: () => void
}

export function ResearchNotebook({ isOpen, onClose }: ResearchNotebookProps) {
    const { pinnedMarkets, notes, summary, unpinMarket, addNote, deleteNote, setSummary, clearAll } = useResearchStore()
    const [noteInput, setNoteInput] = useState('')
    const [isSummarizing, setIsSummarizing] = useState(false)

    const handleAddNote = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (noteInput.trim()) {
            addNote(noteInput.trim())
            setNoteInput('')
        }
    }

    const handleSummarize = async () => {
        if (pinnedMarkets.length === 0 && notes.length === 0) return

        setIsSummarizing(true)
        try {
            const res = await fetch('/api/hub/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markets: pinnedMarkets, notes })
            })
            if (res.ok) {
                const data = await res.json()
                setSummary(data.summary)
            }
        } catch (err) {
            console.error('Summarization failed', err)
        } finally {
            setIsSummarizing(false)
        }
    }

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9000] animate-in fade-in duration-300"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div className={cn(
                "fixed top-0 right-0 h-full w-[400px] bg-[#0a0b0d] border-l border-white/10 z-[9001] shadow-2xl transition-transform duration-500 ease-out flex flex-col",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-purple-400" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Research Notebook</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-8">

                    {/* AI Summary Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-3 h-3" /> AI Analysis Brief
                            </h3>
                            {(pinnedMarkets.length > 0 || notes.length > 0) && (
                                <button
                                    onClick={handleSummarize}
                                    disabled={isSummarizing}
                                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 transition-all"
                                >
                                    {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    BUILD BRIEF
                                </button>
                            )}
                        </div>

                        {summary ? (
                            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap research-summary">
                                {summary}
                            </div>
                        ) : (
                            <div className="p-8 border-2 border-dashed border-white/5 rounded-xl text-center">
                                <p className="text-[10px] text-gray-600 uppercase font-bold mb-2">No analyst briefing generated</p>
                                <p className="text-[9px] text-gray-700 italic">Pin markets or add notes to synthesize intelligence.</p>
                            </div>
                        )}
                    </div>

                    {/* Pinned Markets */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Pin className="w-3 h-3" /> Pinned Assets
                        </h3>
                        <div className="space-y-2">
                            {pinnedMarkets.length > 0 ? pinnedMarkets.map(market => (
                                <div key={market.id} className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="text-[11px] font-bold text-gray-200 line-clamp-1">{market.title}</p>
                                        <p className="text-[9px] text-gray-500 uppercase">{market.platform} • {((market.price ?? 0) * 100).toFixed(0)}%</p>
                                    </div>
                                    <button
                                        onClick={() => unpinMarket(market.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 rounded transition-all text-gray-500 hover:text-red-400"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )) : (
                                <p className="text-[10px] text-gray-600 italic">Click the pin icon on any market to track it here.</p>
                            )}
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div className="space-y-4 pb-20">
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Send className="w-3 h-3" /> Field Notes
                        </h3>

                        <form onSubmit={handleAddNote} className="relative">
                            <textarea
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAddNote())}
                                placeholder="Type an insight..."
                                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500/30 transition-all resize-none"
                            />
                            <button
                                type="submit"
                                className="absolute bottom-3 right-3 p-1.5 bg-purple-500/20 hover:bg-purple-500/40 rounded-lg text-purple-400 transition-all"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </form>

                        <div className="space-y-3">
                            {notes.map(note => (
                                <div key={note.id} className="group p-3 rounded-xl bg-white/5 border border-white/5 relative">
                                    <p className="text-[11px] text-gray-300 leading-relaxed pr-6">{note.content}</p>
                                    <div className="mt-2 text-[8px] text-gray-600 font-mono uppercase">
                                        {new Date(note.timestamp).toLocaleString()}
                                    </div>
                                    <button
                                        onClick={() => deleteNote(note.id)}
                                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black flex justify-between items-center">
                    <div className="text-[9px] text-gray-600 font-mono uppercase">
                        {pinnedMarkets.length} Assets • {notes.length} Intelligence Items
                    </div>
                    <button
                        onClick={clearAll}
                        className="text-[9px] font-bold text-gray-500 hover:text-white transition-colors"
                    >
                        PURGE ALL
                    </button>
                </div>
            </div>
        </>
    )
}
