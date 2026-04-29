'use client'
import { useState, useRef } from 'react'
import { Source } from '@/lib/types'
import { showError } from './ErrorToast'

const MAX_CONCURRENT_UPLOADS = 2

type UploadTask = {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export function SourcesPanel({ 
  notebookId, 
  sources, 
  selectedIds, 
  onToggle, 
  onSourceAdded, 
  onSourceDeleted 
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
  const [error, setError] = useState<string | null>(null)
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filtered = sources.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
  const selectedCount = sources.filter(s => selectedIds.has(s.id)).length

  function reset() { 
    setAddMode(null)
    setTextBody('')
    setTextTitle('')
    setUrlValue('')
    setUrlTitle('')
    setError(null)
  }

  async function addText() {
    if (!textBody.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/text`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ body: textBody, title: textTitle }) 
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      reset(); onSourceAdded()
    } catch { setError('Failed to add source.') }
    finally { setLoading(false) }
  }

  async function uploadFile(task: UploadTask): Promise<void> {
    console.log('[Upload] Starting:', task.file.name)
    setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: 'uploading' as const } : t))
    
    try {
      const fd = new FormData()
      fd.append('file', task.file)
      const res = await fetch(`/api/notebooks/${notebookId}/sources/file`, { method: 'POST', body: fd })
      
      if (!res.ok) {
        let errorMsg = 'Upload failed'
        try {
          const d = await res.json()
          errorMsg = d.error || errorMsg
        } catch {
          if (res.status === 404) errorMsg = 'API endpoint not found'
          else if (res.status === 502) errorMsg = 'OpenRAG service unavailable'
          else if (res.status >= 500) errorMsg = 'Server error'
        }
        console.log('[Upload] Error:', task.file.name, errorMsg)
        setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' as const, error: errorMsg } : t))
        throw new Error(errorMsg)
      } else {
        const isDuplicate = res.status === 200
        console.log('[Upload] Success:', task.file.name, isDuplicate ? '(duplicate)' : '')
        setUploadQueue(prev => prev.map(t => t.id === task.id ? { 
          ...t, 
          status: 'success' as const,
          error: isDuplicate ? 'Duplicate (skipped)' : undefined
        } : t))
        
        if (!isDuplicate) {
          onSourceAdded()
        }
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Network error'
      console.log('[Upload] Exception:', task.file.name, errorMsg)
      setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' as const, error: errorMsg } : t))
      throw e
    }
  }

  async function processUploadQueue(tasks: UploadTask[]) {
    console.log('[Queue] Starting batch processing for', tasks.length, 'files')
    
    // Process in batches
    for (let i = 0; i < tasks.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = tasks.slice(i, i + MAX_CONCURRENT_UPLOADS)
      console.log('[Queue] Processing batch', Math.floor(i / MAX_CONCURRENT_UPLOADS) + 1, ':', batch.map(t => t.file.name))
      
      // Upload batch in parallel and wait for all to complete
      const batchPromises = batch.map(task => uploadFile(task))
      await Promise.allSettled(batchPromises)
      
      console.log('[Queue] Batch complete')
    }
    
    console.log('[Queue] All uploads complete, status will remain until manually cleared')
    // Don't auto-clear - let user clear manually with the Clear button
  }

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return
    
    const newTasks: UploadTask[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending' as const,
    }))
    
    setUploadQueue(newTasks)
    
    // Start processing immediately
    processUploadQueue(newTasks)
  }

  async function addUrl() {
    if (!urlValue.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/url`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ url: urlValue, title: urlTitle }) 
      })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      reset(); onSourceAdded()
    } catch { setError('Failed to add URL.') }
    finally { setLoading(false) }
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
    if (count === 0) return
    if (!confirm(`Delete ${count} selected source${count > 1 ? 's' : ''}?`)) return
    
    setLoading(true)
    try {
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/notebooks/${notebookId}/sources/${id}`, { method: 'DELETE' })
      )
      const results = await Promise.allSettled(deletePromises)
      
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) {
        showError(`Failed to delete ${failed} source${failed > 1 ? 's' : ''}`)
      }
      
      onSourceDeleted()
    } catch {
      showError('Failed to delete sources.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Sources</h2>
          {selectedCount > 0 && <span className="text-sm text-gray-500">({selectedCount} selected)</span>}
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <button 
              onClick={deleteSelected} 
              disabled={loading}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              Delete ({selectedCount})
            </button>
          )}
          <button onClick={() => setAddMode('file')} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            + Add
          </button>
        </div>
      </div>

      {addMode && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setAddMode('file')} className={`px-3 py-1 rounded text-sm ${addMode === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>File</button>
            <button onClick={() => setAddMode('text')} className={`px-3 py-1 rounded text-sm ${addMode === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Text</button>
            <button onClick={() => setAddMode('url')} className={`px-3 py-1 rounded text-sm ${addMode === 'url' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>URL</button>
            <button onClick={reset} className="ml-auto px-3 py-1 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          </div>

          {addMode === 'file' && (
            <div>
              <input 
                ref={fileInputRef}
                type="file" 
                multiple
                onChange={(e) => handleFileSelect(e.target.files)} 
                className="block w-full text-sm" 
              />
              <p className="text-xs text-gray-500 mt-1">Select multiple files to upload</p>
            </div>
          )}

          {addMode === 'text' && (
            <div className="space-y-2">
              <input value={textTitle} onChange={e => setTextTitle(e.target.value)} placeholder="Title (optional)" className="w-full px-3 py-2 border rounded" />
              <textarea value={textBody} onChange={e => setTextBody(e.target.value)} placeholder="Paste text here..." rows={4} className="w-full px-3 py-2 border rounded" />
              <button onClick={addText} disabled={loading || !textBody.trim()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
                {loading ? 'Adding...' : 'Add Text'}
              </button>
            </div>
          )}

          {addMode === 'url' && (
            <div className="space-y-2">
              <input value={urlTitle} onChange={e => setUrlTitle(e.target.value)} placeholder="Title (optional)" className="w-full px-3 py-2 border rounded" />
              <input value={urlValue} onChange={e => setUrlValue(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border rounded" />
              <button onClick={addUrl} disabled={loading || !urlValue.trim()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
                {loading ? 'Adding...' : 'Add URL'}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
      )}

      {uploadQueue.length > 0 && (
        <div className="p-4 border-b bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Upload Queue ({uploadQueue.length})</h3>
            <button 
              onClick={() => setUploadQueue([])} 
              className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-200"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {uploadQueue.map(task => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                {task.status === 'pending' && <span className="text-gray-400">⏳</span>}
                {task.status === 'uploading' && <span className="text-blue-600">⬆️</span>}
                {task.status === 'success' && <span className="text-green-600">✓</span>}
                {task.status === 'error' && <span className="text-red-600">✗</span>}
                <span className="flex-1 truncate">{task.file.name}</span>
                {task.error && <span className="text-xs text-red-600">{task.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-b">
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Search sources..." 
          className="w-full px-3 py-2 border rounded text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {sources.length === 0 ? 'No sources yet. Add your first source above.' : 'No sources match your search.'}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map(s => (
              <div key={s.id} className="p-4 hover:bg-gray-50 flex items-start gap-3">
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(s.id)} 
                  onChange={() => onToggle(s.id)} 
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-sm text-gray-500 capitalize">{s.type}</div>
                </div>
                <button onClick={() => deleteSource(s.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
