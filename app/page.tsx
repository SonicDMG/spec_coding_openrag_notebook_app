'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Pencil, Trash2, X, Check, Loader2, Database, FolderOpen } from 'lucide-react'
import type { Notebook } from '@/lib/types'

interface NotebookSummary extends Notebook {
  sourceCount: number
  noteCount: number
}

export default function HomePage() {
  const router = useRouter()
  const [notebooks, setNotebooks] = useState<NotebookSummary[]>([])
  const [creating, setCreating] = useState(false)
  const [createMode, setCreateMode] = useState<'new' | 'import'>('new')
  const [newName, setNewName] = useState('')
  const [availableFilters, setAvailableFilters] = useState<{ id: string; name: string; description: string; documentCount: number }[]>([])
  const [selectedFilterId, setSelectedFilterId] = useState<string>('')
  const [filtersLoading, setFiltersLoading] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => { if (creating || renamingId) inputRef.current?.focus() }, [creating, renamingId])

  useEffect(() => {
    if (createMode === 'import' && creating && availableFilters.length === 0 && !filtersLoading) {
      setFiltersLoading(true)
      fetch('/api/openrag/filters')
        .then(async res => {
          if (!res.ok) throw new Error('Failed to load filters')
          const data = await res.json()
          setAvailableFilters(data.filters)
        })
        .catch(() => setError('Failed to load OpenRAG filters.'))
        .finally(() => setFiltersLoading(false))
    }
  }, [createMode, creating, availableFilters.length, filtersLoading])

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
    try {
      const body = createMode === 'import' && selectedFilterId
        ? { name: newName.trim() || undefined, filterId: selectedFilterId }
        : { name: newName.trim() }
      const res = await fetch('/api/notebooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      const nb = await res.json()
      resetCreate()
      router.push(`/notebooks/${nb.id}`)
    } catch { setError('Failed to create notebook.') }
  }

  function resetCreate() {
    setCreating(false)
    setNewName('')
    setCreateMode('new')
    setSelectedFilterId('')
    setAvailableFilters([])
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
        <div className="mb-4 p-4 border rounded-lg bg-card space-y-3">
          <div className="flex gap-1">
            <button onClick={() => setCreateMode('new')}
              className={`text-xs px-3 py-1 rounded font-medium transition-colors ${createMode === 'new' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              Create new
            </button>
            <button onClick={() => setCreateMode('import')}
              className={`text-xs px-3 py-1 rounded font-medium transition-colors ${createMode === 'import' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              Import from OpenRAG
            </button>
          </div>

          <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createNotebook(); if (e.key === 'Escape') resetCreate() }}
            placeholder={createMode === 'import' ? 'Notebook name (optional — uses filter name if empty)' : 'Notebook name'}
            className="w-full border rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />

          {createMode === 'import' && (
            <div>
              {filtersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading filters…
                </div>
              ) : availableFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No available OpenRAG filters found.</p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Select a filter</p>
                  {availableFilters.map(f => {
                    const isSelected = selectedFilterId === f.id
                    return (
                      <button key={f.id} onClick={() => {
                        setSelectedFilterId(f.id)
                        if (!newName.trim()) setNewName(f.name)
                      }}
                        className={`w-full text-left px-3 py-2 rounded border text-sm transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                            : 'border-border hover:bg-muted/40'
                        }`}>
                        <div className="flex items-center gap-2">
                          <div className={`shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                            {isSelected ? <Check size={14} /> : <Database size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isSelected ? 'text-primary' : ''}`}>{f.name}</p>
                            {f.description && <p className="text-xs text-muted-foreground truncate">{f.description}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{f.documentCount} doc{f.documentCount !== 1 ? 's' : ''}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={createNotebook}
                disabled={createMode === 'new' ? !newName.trim() : !selectedFilterId}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  (createMode === 'new' && !newName.trim()) || (createMode === 'import' && !selectedFilterId)
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                }`}>
                {createMode === 'import' ? 'Import' : 'Create'}
              </button>
              <button onClick={resetCreate} className="px-3 py-1.5 rounded text-sm border hover:bg-muted">Cancel</button>
            </div>
            {createMode === 'import' && (
              <p className="text-xs text-muted-foreground">
                {!selectedFilterId ? 'Select a filter above to import.' : `Importing as "${newName.trim() || 'filter name'}"`}
              </p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : notebooks.length === 0 && !creating ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notebooks yet</p>
          <p className="text-sm mt-1">Click "New notebook" to create one or import from OpenRAG.</p>
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
