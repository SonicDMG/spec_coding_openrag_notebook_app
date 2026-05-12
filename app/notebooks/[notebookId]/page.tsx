'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SourcesPanel } from '@/components/SourcesPanel'
import ChatPanel from '@/components/ChatPanel'
import NotesPanel from '@/components/NotesPanel'
import type { Notebook, Source, Note, ChatMessage } from '@/lib/types'

type Panel = 'sources' | 'chat' | 'notes'

interface PendingGeneration {
  mode: 'overview' | 'table' | 'mindmap'
  prompt?: string
}

export default function NotebookPage() {
  const router = useRouter()
  const params = useParams()
  const notebookId = params.notebookId as string

  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null)
  const [activePanel, setActivePanel] = useState<Panel>('chat')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId])

  useEffect(() => {
    // Auto-select all sources when sources change
    setSelectedIds(new Set(sources.map(s => s.id)))
  }, [sources])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [nbRes, srcRes, notesRes, msgsRes] = await Promise.all([
        fetch(`/api/notebooks/${notebookId}`),
        fetch(`/api/notebooks/${notebookId}/sources`),
        fetch(`/api/notebooks/${notebookId}/notes`),
        fetch(`/api/notebooks/${notebookId}/messages`),
      ])

      if (!nbRes.ok) {
        if (nbRes.status === 404) {
          router.push('/')
          return
        }
        throw new Error('Failed to load notebook')
      }

      const nb = await nbRes.json()
      const srcData = await srcRes.json()
      const notesData = await notesRes.json()
      const msgsData = msgsRes.ok ? await msgsRes.json() : { messages: [] }

      setNotebook(nb)
      setSources(srcData.sources)
      setNotes(notesData.notes)
      setMessages(msgsData.messages)
    } catch (e) {
      console.error('Load error:', e)
      setError(e instanceof Error ? e.message : 'Failed to load notebook')
    } finally {
      setLoading(false)
    }
  }

  async function refreshSources() {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources`)
      if (res.ok) {
        const data = await res.json()
        setSources(data.sources)
      }
    } catch { /* best-effort */ }
  }

  function toggleSource(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addMessage(msg: Partial<ChatMessage> & { role: 'user' | 'assistant' }) {
    const id = msg.id ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
    setMessages(prev => {
      // Prevent duplicate messages
      if (prev.some(m => m.id === id)) return prev
      return [...prev, { id, role: msg.role, content: msg.content ?? '', sources: msg.sources, suggestions: msg.suggestions }]
    })
  }

  function updateMessage(id: string, updates: Partial<ChatMessage>) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  function handleSuggestionClick(suggestion: { action: string; mode?: string; prompt?: string }) {
    if (suggestion.action === 'generate' && suggestion.mode) {
      setPendingGeneration({ mode: suggestion.mode as 'overview' | 'table' | 'mindmap', prompt: suggestion.prompt })
      setActivePanel('notes')
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading notebook…</p>
      </div>
    )
  }

  if (error || !notebook) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || 'Notebook not found'}</p>
          <button onClick={() => router.push('/')} className="text-sm text-primary hover:underline">
            ← Back to notebooks
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="p-1.5 hover:bg-muted rounded-md transition-colors"
          title="Back to notebooks"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold truncate flex-1">{notebook.name}</h1>

        <ThemeToggle />

        {/* Mobile panel selector */}
        <div className="lg:hidden flex gap-1">
          <button
            onClick={() => setActivePanel('sources')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activePanel === 'sources'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Sources
          </button>
          <button
            onClick={() => setActivePanel('chat')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activePanel === 'chat'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActivePanel('notes')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activePanel === 'notes'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Notes
          </button>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: three columns */}
        <div className="hidden lg:grid lg:grid-cols-[300px_1fr_320px] h-full">
          <div data-panel="sources" className="border-r bg-card overflow-hidden">
            <SourcesPanel
              notebookId={notebookId}
              sources={sources}
              selectedIds={selectedIds}
              onToggle={toggleSource}
              onSourceAdded={refreshSources}
              onSourceDeleted={refreshSources}
            />
          </div>
          <div data-panel="chat" className="bg-background overflow-hidden">
            <ChatPanel
              notebookId={notebookId}
              sources={sources}
              selectedIds={selectedIds}
              messages={messages}
              setMessages={setMessages}
              addMessage={addMessage}
              updateMessage={updateMessage}
              initialChatId={notebook.openragChatId}
              onNoteSaved={load}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
          <div data-panel="notes" className="border-l bg-card overflow-hidden">
            <NotesPanel
              notebookId={notebookId}
              notes={notes}
              sources={sources}
              selectedIds={selectedIds}
              addMessage={addMessage}
              updateMessage={updateMessage}
              pendingGeneration={pendingGeneration}
              onPendingGenerationDone={() => setPendingGeneration(null)}
              onNotesChanged={load}
            />
          </div>
        </div>

        {/* Mobile: single panel */}
        <div className="lg:hidden h-full">
          {activePanel === 'sources' && (
            <div data-panel="sources" className="h-full bg-card">
              <SourcesPanel
                notebookId={notebookId}
                sources={sources}
                selectedIds={selectedIds}
                onToggle={toggleSource}
                onSourceAdded={load}
                onSourceDeleted={load}
              />
            </div>
          )}
          {activePanel === 'chat' && (
            <div data-panel="chat" className="h-full bg-background">
              <ChatPanel
                notebookId={notebookId}
                sources={sources}
                selectedIds={selectedIds}
                messages={messages}
                setMessages={setMessages}
                addMessage={addMessage}
                updateMessage={updateMessage}
                initialChatId={notebook.openragChatId}
                onNoteSaved={load}
                onSuggestionClick={handleSuggestionClick}
              />
            </div>
          )}
          {activePanel === 'notes' && (
            <div data-panel="notes" className="h-full bg-card">
              <NotesPanel
                notebookId={notebookId}
                notes={notes}
                sources={sources}
                selectedIds={selectedIds}
                addMessage={addMessage}
                updateMessage={updateMessage}
                pendingGeneration={null}
                onPendingGenerationDone={undefined}
                onNotesChanged={load}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
