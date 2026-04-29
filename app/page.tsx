'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Pencil, Trash2, X, Check } from 'lucide-react'
import type { Notebook } from '@/lib/types'

interface NotebookSummary extends Notebook {
  sourceCount: number
  noteCount: number
}

export default function HomePage() {
  const router = useRouter()
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => { if (creating || renamingId) inputRef.current?.focus() }, [creating, renamingId])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/notebooks')
      const data = await res.json()
      setNotebooks(data.notebooks)
    } catch { setError('Failed to load notebooks.') }
    finally { setLoading(false) }
  }

  async function createNotebook() {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/notebooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      const nb = await res.json()
      setCreating(false)
      setNewName('')
      router.push(`/notebooks/${nb.id}`)
    } catch { setError('Failed to create notebook.') }
  }

  async function renameNotebook(id: string) {
    if (!renameValue.trim()) return
    try {
      const res = await fetch(`/api/notebooks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renameValue.trim() }) })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      setRenamingId(null)
      load()
    } catch { setError('Failed to rename notebook.') }
  }

  async function deleteNotebook(id: string) {
    try {
      await fetch(`/api/notebooks/${id}`, { method: 'DELETE' })
      setDeletingId(null)
      load()
    } catch { setError('Failed to delete notebook.') }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">My Notebooks</h1>
        <button onClick={() => { setCreating(true); setNewName('') }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={16} /> New notebook
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm flex justify-between">
          {error} <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {creating && (
        <div className="mb-4 p-4 border rounded-lg bg-card flex gap-2">
          <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createNotebook(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
            placeholder="Notebook name" className="flex-1 border rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={createNotebook} className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-sm font-medium">Create</button>
          <button onClick={() => { setCreating(false); setNewName('') }} className="px-3 py-1.5 rounded text-sm border hover:bg-muted">Cancel</button>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : notebooks.length === 0 && !creating ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notebooks yet</p>
          <p className="text-sm mt-1">Click "New notebook" to get started.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notebooks.map(nb => (
            <li key={nb.id} className="p-4 border rounded-lg bg-card hover:shadow-sm transition-shadow group">
              {renamingId === nb.id ? (
                <div className="flex gap-2">
                  <input ref={inputRef} value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameNotebook(nb.id); if (e.key === 'Escape') setRenamingId(null) }}
                    className="flex-1 border rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <button onClick={() => renameNotebook(nb.id)} className="p-1 hover:text-primary"><Check size={16} /></button>
                  <button onClick={() => setRenamingId(null)} className="p-1 hover:text-muted-foreground"><X size={16} /></button>
                </div>
              ) : deletingId === nb.id ? (
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex-1">Delete "<strong>{nb.name}</strong>"? This cannot be undone.</span>
                  <button onClick={() => deleteNotebook(nb.id)} className="text-destructive font-medium hover:underline">Delete</button>
                  <button onClick={() => setDeletingId(null)} className="text-muted-foreground hover:underline">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center">
                  <button onClick={() => router.push(`/notebooks/${nb.id}`)} className="flex-1 text-left">
                    <p className="font-medium">{nb.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{nb.sourceCount} source{nb.sourceCount !== 1 ? 's' : ''} · {nb.noteCount} note{nb.noteCount !== 1 ? 's' : ''}</p>
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setRenamingId(nb.id); setRenameValue(nb.name) }} className="p-1.5 rounded hover:bg-muted" title="Rename"><Pencil size={14} /></button>
                    <button onClick={() => setDeletingId(nb.id)} className="p-1.5 rounded hover:bg-muted text-destructive" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
