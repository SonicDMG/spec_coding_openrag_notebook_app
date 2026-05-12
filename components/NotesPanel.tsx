'use client'

import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import Markdown from '@/components/Markdown'
import { Plus, Trash2, Pencil, X, Check, Sparkles, ChevronLeft, Table2, Network, Minimize2, Loader2, AlertCircle } from 'lucide-react'
import type { Note, Source, ChatMessage, ChatSuggestion } from '@/lib/types'

const MindMapRenderer = lazy(() => import('./MindMapRenderer'))

interface Props {
  notebookId: string
  notes: Note[]
  sources: Source[]
  selectedIds: Set<string>
  addMessage: (msg: Partial<ChatMessage> & { role: 'user' | 'assistant' }) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  pendingGeneration?: { mode: 'overview' | 'table' | 'mindmap'; prompt?: string } | null
  onPendingGenerationDone?: () => void
  onNotesChanged: () => void
}

type GenerateMode = null | 'overview' | 'table' | 'mindmap'

type PendingNote = {
  id: string
  type: 'overview' | 'table' | 'mindmap'
  status: 'generating' | 'error'
  errorMsg?: string
}

export default function NotesPanel({ notebookId, notes, sources, selectedIds, addMessage, updateMessage, pendingGeneration, onPendingGenerationDone, onNotesChanged }: Props) {
  const [openNote, setOpenNote] = useState<Note | null>(null)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set())
  const [generateMode, setGenerateMode] = useState<GenerateMode>(null)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [pendingNotes, setPendingNotes] = useState<PendingNote[]>([])
  const [error, setError] = useState<string | null>(null)

  const noneSelected = selectedIds.size === 0
  const noSources = sources.length === 0

  // Sync open note with latest data
  useEffect(() => {
    if (openNote) {
      const updated = notes.find(n => n.id === openNote.id)
      if (updated) setOpenNote(updated)
      else setOpenNote(null)
    }
  }, [notes])

  // Reset expansion when closing a note
  useEffect(() => {
    if (!openNote) setNoteExpanded(false)
  }, [openNote])

  // Handle pending generation from ChatPanel suggestions
  useEffect(() => {
    if (pendingGeneration) {
      generate(pendingGeneration.mode, pendingGeneration.prompt)
      onPendingGenerationDone?.()
    }
  }, [pendingGeneration])

  function closeNote() {
    if (noteExpanded) {
      setNoteExpanded(false)
      setTimeout(() => {
        setOpenNote(null)
        setEditing(false)
      }, 300)
    } else {
      setOpenNote(null)
      setEditing(false)
    }
  }

  function preview(note: Note) {
    if (note.body) return note.body.slice(0, 100)
    if (note.tableData) return `Table: ${note.tableData.headers.join(', ')}`
    if (note.mindMapData) return `Mind map: ${note.mindMapData.nodes.length} concepts`
    return ''
  }

  async function saveEdit() {
    if (!openNote || !editBody.trim()) return
    const res = await fetch(`/api/notebooks/${notebookId}/notes/${openNote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle || undefined, body: editBody }),
    })
    if (res.ok) { setEditing(false); onNotesChanged() }
    else { const d = await res.json(); setError(d.error) }
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notebooks/${notebookId}/notes/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (openNote?.id === id) closeNote()
    onNotesChanged()
  }

  function toggleSelectMode() {
    setSelectMode(s => !s)
    setSelectedNoteIds(new Set())
  }

  function toggleNoteSelection(id: string) {
    setSelectedNoteIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deleteSelected() {
    await Promise.all(
      Array.from(selectedNoteIds).map(id =>
        fetch(`/api/notebooks/${notebookId}/notes/${id}`, { method: 'DELETE' })
      )
    )
    setSelectedNoteIds(new Set())
    setSelectMode(false)
    onNotesChanged()
  }

  async function createNote() {
    if (!newBody.trim()) return
    const title = newTitle.trim() || newBody.trim().split('\n')[0].slice(0, 60) || 'Untitled Note'
    const res = await fetch(`/api/notebooks/${notebookId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'manual', title, body: newBody }),
    })
    if (res.ok) { setCreating(false); setNewTitle(''); setNewBody(''); onNotesChanged() }
    else { const d = await res.json(); setError(d.error) }
  }

  async function generate(mode: GenerateMode, overridePrompt?: string) {
    if (!mode) return

    const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const capturedPrompt = overridePrompt ?? generatePrompt

    // Optimistically add the card and dismiss the form immediately
    setPendingNotes(prev => [...prev, { id: tempId, type: mode, status: 'generating' }])
    setGenerateMode(null)
    setGeneratePrompt('')
    setError(null)

    const removePending = () => setPendingNotes(prev => prev.filter(p => p.id !== tempId))
    const failPending = (msg: string) => setPendingNotes(prev =>
      prev.map(p => p.id === tempId ? { ...p, status: 'error' as const, errorMsg: msg } : p)
    )

    const endpoint = mode === 'overview' ? 'overview' : mode === 'table' ? 'table' : 'mindmap'
    const extra = mode === 'table' ? { prompt: capturedPrompt } : mode === 'mindmap' ? { topic: capturedPrompt } : {}

    const thinkingMsgId = `msg_${Date.now()}_thinking`
    const isStreamable = mode === 'overview'
    let streamedContent = ''

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/generate/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedSourceIds: Array.from(selectedIds), ...extra }),
      })

      if (!res.ok) {
        const d = await res.json()
        failPending(d.error ?? 'Generation failed')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let hasThinkingMsg = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const lines = part.split('\n')
          const eventLine = lines.find(l => l.startsWith('event:'))
          const dataLine = lines.find(l => l.startsWith('data:'))
          if (!eventLine || !dataLine) continue
          const eventType = eventLine.slice(7).trim()
          const data = JSON.parse(dataLine.slice(5).trim())

          if (eventType === 'status') {
            if (!hasThinkingMsg) {
              addMessage({ id: thinkingMsgId, role: 'assistant', content: '' })
              hasThinkingMsg = true
            }
          } else if (eventType === 'content') {
            if (isStreamable && hasThinkingMsg) {
              streamedContent += data.delta
              updateMessage(thinkingMsgId, { content: streamedContent })
            }
          } else if (eventType === 'sources') {
            if (hasThinkingMsg) {
              updateMessage(thinkingMsgId, { sources: data.sources })
            }
          } else if (eventType === 'done') {
            const note = data.note
            const typeLabel = note.type === 'mindmap' ? 'mind map' : note.type === 'table' ? 'data table' : 'overview'

            const suggestions: ChatSuggestion[] = []
            if (note.type === 'overview') {
              suggestions.push({ label: 'Create a table', action: 'generate', mode: 'table' })
              suggestions.push({ label: 'Create a mind map', action: 'generate', mode: 'mindmap' })
            } else if (note.type === 'table') {
              suggestions.push({ label: 'Create an overview', action: 'generate', mode: 'overview' })
              suggestions.push({ label: 'Create a mind map', action: 'generate', mode: 'mindmap' })
            } else if (note.type === 'mindmap') {
              suggestions.push({ label: 'Create an overview', action: 'generate', mode: 'overview' })
              suggestions.push({ label: 'Create a table', action: 'generate', mode: 'table' })
            }

            if (hasThinkingMsg) {
              if (isStreamable) {
                updateMessage(thinkingMsgId, { suggestions })
              } else {
                const completionMsg = `I've finished creating the ${typeLabel} "${note.title}". You can find it in the Notes panel.`
                updateMessage(thinkingMsgId, { content: completionMsg, suggestions })
              }
            }

            removePending()
            onNotesChanged()
          } else if (eventType === 'error') {
            failPending(data.error ?? 'Generation failed')
            if (hasThinkingMsg) {
              updateMessage(thinkingMsgId, { content: `❌ Generation failed: ${data.error}` })
            } else {
              addMessage({ role: 'assistant', content: `Generation failed: ${data.error}` })
            }
          }
        }
      }
    } catch {
      failPending('Generation failed.')
      addMessage({ role: 'assistant', content: 'Generation failed. Please try again.' })
    }
  }

  // ── Note detail content (shared between panel and overlay) ─────────────────
  function noteDetailContent() {
    if (!openNote) return null
    return (
      <>
        <div className="p-3 border-b flex items-center gap-2 shrink-0">
          <button onClick={closeNote} className="p-1 hover:bg-muted rounded">
            <ChevronLeft size={16} />
          </button>
          {editing ? (
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="flex-1 border rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring" />
          ) : (
            <h3 className="flex-1 text-sm font-medium truncate">{openNote.title}</h3>
          )}
          {['manual', 'chat', 'overview'].includes(openNote.type) && !editing && (
            <button onClick={() => { setEditing(true); setEditTitle(openNote.title); setEditBody(openNote.body ?? '') }}
              className="p-1 hover:bg-muted rounded"><Pencil size={14} /></button>
          )}
          {editing && (
            <>
              <button onClick={saveEdit} className="p-1 hover:text-primary"><Check size={16} /></button>
              <button onClick={() => setEditing(false)} className="p-1 hover:text-muted-foreground"><X size={16} /></button>
            </>
          )}
          {deletingId === openNote.id ? (
            <>
              <button onClick={() => deleteNote(openNote.id)} className="text-xs text-destructive font-medium">Delete</button>
              <button onClick={() => setDeletingId(null)} className="text-xs text-muted-foreground">Cancel</button>
            </>
          ) : (
            <button onClick={() => setDeletingId(openNote.id)} className="p-1 hover:bg-muted rounded text-destructive">
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={closeNote}
            className="p-1 hover:bg-muted rounded"
            title="Collapse note"
          >
            <Minimize2 size={13} />
          </button>
        </div>
        <div className={`flex-1 min-h-0 ${openNote.type === 'mindmap' ? 'overflow-hidden' : 'overflow-y-auto p-4'}`}>
          {error && <p className="text-xs text-destructive mb-2 px-4 pt-4">{error}</p>}
          {editing ? (
            <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={15}
              className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          ) : openNote.type === 'table' && openNote.tableData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr>{openNote.tableData.headers.map((h, i) => <th key={i} className="text-left p-2 border-b font-semibold bg-muted">{h}</th>)}</tr></thead>
                <tbody>{openNote.tableData.rows.map((row, i) => <tr key={i} className="border-b hover:bg-muted/30">{row.map((cell, j) => <td key={j} className="p-2">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : openNote.type === 'mindmap' && openNote.mindMapData ? (
            <Suspense fallback={<p className="text-xs text-muted-foreground">Loading map…</p>}>
              <MindMapRenderer data={openNote.mindMapData} />
            </Suspense>
          ) : (
            <Markdown>{openNote.body ?? ''}</Markdown>
          )}
        </div>
      </>
    )
  }

  // ── Note detail view (panel) ───────────────────────────────────────────────
  if (openNote) {
    return (
      <>
        {/* Normal panel detail (always rendered so position is preserved) */}
        <div className="flex flex-col h-full">
          {noteDetailContent()}
        </div>

        {/* Full-screen overlay — slides in from the Notes panel's left edge */}
        <div
          className={`fixed inset-0 z-50 bg-card flex flex-col transition-transform duration-300 ease-in-out ${
            noteExpanded ? '' : 'pointer-events-none'
          }`}
          style={{ transform: noteExpanded ? 'translateX(0)' : 'translateX(calc(100vw - 320px))' }}
          aria-hidden={!noteExpanded}
        >
          {noteDetailContent()}
        </div>
      </>
    )
  }

  // ── Notes list ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</span>
          {selectMode ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedNoteIds(new Set(notes.map(n => n.id)))}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted">
                All
              </button>
              <button onClick={toggleSelectMode}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {notes.length > 0 && (
                <button onClick={toggleSelectMode}
                  className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded hover:bg-muted">
                  Select
                </button>
              )}
              <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90">
                <Plus size={12} /> New
              </button>
            </div>
          )}
        </div>

        {/* Generate buttons — hidden in select mode */}
        {!noSources && !selectMode && (
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setGenerateMode('overview')} disabled={noneSelected}
              className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-muted disabled:opacity-40">
              <Sparkles size={11} /> Overview
            </button>
            <button onClick={() => setGenerateMode('table')} disabled={noneSelected}
              className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-muted disabled:opacity-40">
              <Table2 size={11} /> Table
            </button>
            <button onClick={() => setGenerateMode('mindmap')} disabled={noneSelected}
              className="flex items-center gap-1 text-xs px-2 py-1 border rounded hover:bg-muted disabled:opacity-40">
              <Network size={11} /> Mind map
            </button>
          </div>
        )}
      </div>

      {/* Bulk delete bar */}
      {selectMode && selectedNoteIds.size > 0 && (
        <div className="px-3 py-2 border-b bg-destructive/10 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{selectedNoteIds.size} selected</span>
          <button onClick={deleteSelected}
            className="flex items-center gap-1 text-xs text-destructive font-medium hover:underline">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Generate form */}
      {generateMode && (
        <div className="p-3 border-b bg-muted/30 space-y-2 text-sm">
          {error && <p className="text-xs text-destructive">{error}</p>}
          {generateMode !== 'overview' && (
            <input value={generatePrompt} onChange={e => setGeneratePrompt(e.target.value)}
              placeholder={generateMode === 'table' ? 'Focus prompt (optional)' : 'Focus topic (optional)'}
              className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
          )}
          <div className="flex gap-2">
            <button onClick={() => generate(generateMode)}
              className="flex-1 bg-primary text-primary-foreground py-1.5 rounded text-xs font-medium">
              Generate {generateMode}
            </button>
            <button onClick={() => { setGenerateMode(null); setGeneratePrompt(''); setError(null) }}
              className="px-3 py-1.5 border rounded text-xs hover:bg-muted"><X size={12} /></button>
          </div>
        </div>
      )}

      {/* New note form — hidden in select mode */}
      {creating && !selectMode && (
        <div className="p-3 border-b bg-muted/30 space-y-2 text-sm">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title (optional)"
            className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
          <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={4} placeholder="Note content…"
            className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring resize-none" />
          <div className="flex gap-2">
            <button onClick={createNote} disabled={!newBody.trim()} className="flex-1 bg-primary text-primary-foreground py-1.5 rounded text-xs font-medium disabled:opacity-50">Save</button>
            <button onClick={() => { setCreating(false); setNewTitle(''); setNewBody('') }} className="px-3 py-1.5 border rounded text-xs hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 && pendingNotes.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            <p>No notes yet.</p>
            <p className="mt-1">Generate one from your sources or create one manually.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {pendingNotes.map(p => (
              <li key={p.id} className="px-3 py-2.5 flex items-center gap-2">
                {p.status === 'generating' ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="h-2.5 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 capitalize">
                      {p.type === 'mindmap' ? 'mind map' : p.type}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={12} className="text-destructive shrink-0" />
                    <p className="flex-1 text-xs text-destructive truncate">{p.errorMsg ?? 'Generation failed'}</p>
                    <button
                      onClick={() => setPendingNotes(prev => prev.filter(x => x.id !== p.id))}
                      className="p-0.5 hover:bg-muted rounded shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </>
                )}
              </li>
            ))}
            {notes.map(n => (
              <li
                key={n.id}
                className={`px-3 py-2.5 hover:bg-muted/40 cursor-pointer group flex items-center gap-2 ${selectMode && selectedNoteIds.has(n.id) ? 'bg-muted/60' : ''}`}
                onClick={selectMode
                  ? () => toggleNoteSelection(n.id)
                  : () => { setOpenNote(n); requestAnimationFrame(() => setNoteExpanded(true)) }}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.has(n.id)}
                    onChange={() => toggleNoteSelection(n.id)}
                    onClick={e => e.stopPropagation()}
                    className="shrink-0 accent-primary"
                  />
                )}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{preview(n)}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5 capitalize">{n.type}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
