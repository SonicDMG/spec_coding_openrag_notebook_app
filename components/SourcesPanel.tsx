'use client'
import { useState, useRef } from 'react'
import { FileText, Globe, AlignLeft, Table, Trash2, Plus, X, Search, CheckSquare, Square, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Source } from '@/lib/types'
import { showError } from './ErrorToast'

const MAX_CONCURRENT_UPLOADS = 2

type UploadTask = {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

function SourceIcon({ type }: { type: Source['type'] }) {
  if (type === 'pdf') return <FileText size={14} className="shrink-0 text-muted-foreground" />
  if (type === 'url') return <Globe size={14} className="shrink-0 text-muted-foreground" />
  if (type === 'csv') return <Table size={14} className="shrink-0 text-muted-foreground" />
  return <AlignLeft size={14} className="shrink-0 text-muted-foreground" />
}

export function SourcesPanel({
  notebookId,
  sources,
  selectedIds,
  onToggle,
  onSourceAdded,
  onSourceDeleted,
}: {
  notebookId: string
  sources: Source[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onSourceAdded: () => void
  onSourceDeleted: () => void
}) {
  const [addMode, setAddMode] = useState<'text' | 'url' | 'file' | null>(null)
  const [textBody, setTextBody] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = sources.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
  const selectedCount = sources.filter(s => selectedIds.has(s.id)).length

  function reset() {
    setAddMode(null); setTextBody(''); setTextTitle('')
    setUrlValue(''); setUrlTitle(''); setError(null)
  }

  async function addText() {
    if (!textBody.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: textBody, title: textTitle }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      reset(); onSourceAdded()
    } catch { setError('Failed to add source.') }
    finally { setLoading(false) }
  }

  async function addUrl() {
    if (!urlValue.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlValue, title: urlTitle }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      reset(); onSourceAdded()
    } catch { setError('Failed to add URL.') }
    finally { setLoading(false) }
  }

  async function uploadFile(task: UploadTask) {
    setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: 'uploading' as const } : t))
    try {
      const fd = new FormData()
      fd.append('file', task.file)
      const res = await fetch(`/api/notebooks/${notebookId}/sources/file`, { method: 'POST', body: fd })
      if (!res.ok) {
        let msg = 'Upload failed'
        try { const d = await res.json(); msg = d.error || msg } catch { /* ignore */ }
        setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' as const, error: msg } : t))
        throw new Error(msg)
      }
      const isDuplicate = res.status === 200
      setUploadQueue(prev => prev.map(t => t.id === task.id ? {
        ...t, status: 'success' as const,
        error: isDuplicate ? 'Duplicate — skipped' : undefined,
      } : t))
      if (!isDuplicate) onSourceAdded()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' as const, error: msg } : t))
      throw e
    }
  }

  async function processQueue(tasks: UploadTask[]) {
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENT_UPLOADS) {
      await Promise.allSettled(tasks.slice(i, i + MAX_CONCURRENT_UPLOADS).map(uploadFile))
    }
  }

  function handleFileSelect(files: FileList | null) {
    if (!files?.length) return
    const tasks: UploadTask[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random()}`, file, status: 'pending' as const,
    }))
    setUploadQueue(tasks)
    processQueue(tasks)
  }

  async function deleteSource(id: string) {
    if (!confirm('Delete this source?')) return
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/${id}`, { method: 'DELETE' })
      if (!res.ok) { showError('Failed to delete source.'); return }
      onSourceDeleted()
    } catch { showError('Failed to delete source.') }
  }

  async function deleteSelected() {
    const count = selectedIds.size
    if (!count || !confirm(`Delete ${count} selected source${count > 1 ? 's' : ''}?`)) return
    setLoading(true)
    try {
      await Promise.allSettled(
        Array.from(selectedIds).map(id => fetch(`/api/notebooks/${notebookId}/sources/${id}`, { method: 'DELETE' }))
      )
      onSourceDeleted()
    } catch { showError('Failed to delete sources.') }
    finally { setLoading(false) }
  }

  async function syncSources() {
    setSyncing(true)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/sync`, { method: 'POST' })
      if (!res.ok) { showError('Failed to sync sources.'); return }
      const { added } = await res.json()
      if (added > 0) onSourceAdded()
    } catch { showError('Failed to sync sources.') }
    finally { setSyncing(false) }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sources</span>
          <button
            onClick={syncSources}
            disabled={syncing}
            title="Sync sources from OpenRAG filter"
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          </button>
          {selectedCount > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium">
              {selectedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedCount > 0 && (
            <button
              onClick={deleteSelected}
              disabled={loading}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              <Trash2 size={11} /> Delete ({selectedCount})
            </button>
          )}
          <button
            onClick={() => setAddMode(addMode ? null : 'file')}
            className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90"
          >
            {addMode ? <X size={11} /> : <Plus size={11} />}
            {addMode ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {addMode && (
        <div className="p-3 border-b bg-muted/30 space-y-2">
          {/* Type tabs */}
          <div className="flex gap-1">
            {(['file', 'url', 'text'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setAddMode(mode)}
                className={`text-xs px-2.5 py-1 rounded capitalize ${
                  addMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {addMode === 'file' && (
            <div
              className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={20} className="mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Click to select PDF, CSV, MD, HTML, DOCX, or TXT</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.csv,.md,.html,.docx,.txt" className="hidden"
                onChange={e => handleFileSelect(e.target.files)} />
            </div>
          )}

          {addMode === 'text' && (
            <div className="space-y-1.5">
              <input value={textTitle} onChange={e => setTextTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
              <textarea value={textBody} onChange={e => setTextBody(e.target.value)}
                placeholder="Paste text content…" rows={4}
                className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring resize-none" />
              <button onClick={addText} disabled={loading || !textBody.trim()}
                className="w-full bg-primary text-primary-foreground py-1.5 rounded text-xs font-medium disabled:opacity-50">
                {loading ? 'Adding…' : 'Add text'}
              </button>
            </div>
          )}

          {addMode === 'url' && (
            <div className="space-y-1.5">
              <input value={urlTitle} onChange={e => setUrlTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
              <input value={urlValue} onChange={e => setUrlValue(e.target.value)}
                placeholder="https://…"
                className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={addUrl} disabled={loading || !urlValue.trim()}
                className="w-full bg-primary text-primary-foreground py-1.5 rounded text-xs font-medium disabled:opacity-50">
                {loading ? 'Adding…' : 'Add URL'}
              </button>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {/* Upload queue */}
      {uploadQueue.length > 0 && (
        <div className="p-3 border-b bg-muted/20 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Uploads</span>
            <button onClick={() => setUploadQueue([])} className="text-[10px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
          {uploadQueue.map(task => (
            <div key={task.id} className="flex items-center gap-2 text-xs">
              {task.status === 'pending' && <Loader2 size={11} className="text-muted-foreground" />}
              {task.status === 'uploading' && <Loader2 size={11} className="text-primary animate-spin" />}
              {task.status === 'success' && <CheckCircle2 size={11} className="text-green-600 shrink-0" />}
              {task.status === 'error' && <AlertCircle size={11} className="text-destructive shrink-0" />}
              <span className="flex-1 truncate text-muted-foreground">{task.file.name}</span>
              {task.error && <span className="text-destructive shrink-0">{task.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sources…"
            className="w-full pl-7 pr-2 py-1.5 border rounded text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {sources.length === 0
              ? 'No sources yet. Add your first source above.'
              : 'No sources match your search.'}
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map(s => {
              const checked = selectedIds.has(s.id)
              return (
                <li key={s.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/40 group">
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggle(s.id)}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    aria-label={checked ? 'Deselect' : 'Select'}
                  >
                    {checked
                      ? <CheckSquare size={14} className="text-primary" />
                      : <Square size={14} />}
                  </button>

                  {/* Icon */}
                  <SourceIcon type={s.type} />

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium truncate block hover:text-primary hover:underline"
                        title={s.title}
                      >
                        {s.title}
                      </a>
                    ) : (
                      <p className="text-xs font-medium truncate" title={s.title}>{s.title}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{s.type}</p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteSource(s.id)}
                    className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                    aria-label="Delete source"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
