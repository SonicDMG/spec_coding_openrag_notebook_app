'use client'

import { useState, useRef, useEffect } from 'react'
import Markdown from '@/components/Markdown'
import { Send, BookmarkPlus, AlertCircle, FileText, Globe, AlignLeft, ChevronDown, ChevronUp, Search } from 'lucide-react'
import type { Source } from '@/lib/types'

interface OpenRAGSource {
  filename: string
  text: string
  score: number
  page?: number | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: OpenRAGSource[]
  saved?: boolean
}

interface Props {
  notebookId: string
  sources: Source[]
  selectedIds: Set<string>
  onNoteSaved: () => void
}

interface ParsedMetadata {
  body: string
  searchQuery: string | null
  sourceFilenames: string[]
}

// Strip the trailing JSON metadata blob that OpenRAG appends to responses.
// The JSON may contain nested objects (search_query, filter.terms.filename, etc.)
function parseContent(raw: string): ParsedMetadata {
  let end = raw.length - 1
  while (end >= 0 && /\s/.test(raw[end])) end--
  if (end < 0 || raw[end] !== '}') return { body: raw, searchQuery: null, sourceFilenames: [] }

  let depth = 0
  let start = end
  for (; start >= 0; start--) {
    if (raw[start] === '}') depth++
    else if (raw[start] === '{') depth--
    if (depth === 0) break
  }

  if (start < 0 || depth !== 0) return { body: raw, searchQuery: null, sourceFilenames: [] }

  const jsonStr = raw.slice(start, end + 1)
  try {
    const data = JSON.parse(jsonStr)
    let body = raw.slice(0, start).trim()
    body = body.replace(/\s*\(Source:[^)]*\)\s*$/, '').trim()
    const searchQuery = data.search_query ?? null
    const sourceFilenames = data.filter?.terms?.filename ?? []
    return { body, searchQuery, sourceFilenames }
  } catch {
    return { body: raw, searchQuery: null, sourceFilenames: [] }
  }
}

function SourceList({ openragSources, appSources }: { openragSources: OpenRAGSource[]; appSources: Source[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Deduplicate by filename, keeping highest-score chunk per file
  const byFile = openragSources.reduce<Record<string, OpenRAGSource>>((acc, s) => {
    if (!acc[s.filename] || s.score > acc[s.filename].score) acc[s.filename] = s
    return acc
  }, {})
  const unique = Object.values(byFile)

  return (
    <div className="space-y-1 px-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sources</p>
      {unique.map(s => {
        const appSource = appSources.find(a => a.openragFilename === s.filename)
        const title = appSource?.title ?? s.filename
        const isUrl = appSource?.type === 'url'
        const isPdf = appSource?.type === 'pdf'
        const isOpen = expanded === s.filename

        const Icon = isPdf ? FileText : isUrl ? Globe : AlignLeft

        return (
          <div key={s.filename} className="rounded-lg border bg-muted/30 overflow-hidden">
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <Icon size={12} className="shrink-0 text-muted-foreground" />
              {isUrl && appSource?.url ? (
                <a
                  href={appSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs font-medium truncate text-primary hover:underline"
                  title={title}
                >
                  {title}
                </a>
              ) : (
                <span className="flex-1 text-xs font-medium truncate" title={title}>{title}</span>
              )}
              {s.page != null && (
                <span className="text-[10px] text-muted-foreground shrink-0">p.{s.page}</span>
              )}
              <button
                onClick={() => setExpanded(isOpen ? null : s.filename)}
                className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground"
                title={isOpen ? 'Hide excerpt' : 'Show excerpt'}
              >
                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
            {isOpen && (
              <div className="px-2.5 pb-2.5 pt-0 border-t text-[11px] text-muted-foreground leading-relaxed bg-muted/10">
                <p className="mt-1.5 whitespace-pre-wrap">{s.text}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ChatPanel({ notebookId, sources, selectedIds, onNoteSaved }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [chatId, setChatId] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const noSources = sources.length === 0
  const noneSelected = selectedIds.size === 0
  const disabled = noSources || noneSelected || streaming

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    const msg = input.trim()
    if (!msg || disabled) return
    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content: msg }
    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setStreaming(true)

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, selectedSourceIds: Array.from(selectedIds), chatId }),
      })

      if (!res.ok) {
        const d = await res.json()
        setMessages(prev => prev.slice(0, -1))
        setError(d.error ?? 'Chat failed.')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

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

          if (eventType === 'content') {
            setMessages(prev => {
              const copy = [...prev]
              copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + data.delta }
              return copy
            })
          } else if (eventType === 'sources') {
            setMessages(prev => {
              const copy = [...prev]
              copy[copy.length - 1] = { ...copy[copy.length - 1], sources: data.sources }
              return copy
            })
          } else if (eventType === 'done') {
            setChatId(data.chatId)
          } else if (eventType === 'error') {
            setError(data.error)
          }
        }
      }
    } catch {
      setError('Connection error. Please try again.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setStreaming(false)
    }
  }

  async function saveAsNote(msg: Message, question: string, idx: number) {
    const title = question.slice(0, 60)
    const res = await fetch(`/api/notebooks/${notebookId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'chat', title, body: msg.content }),
    })
    if (res.ok) {
      setMessages(prev => prev.map((m, i) => i === idx ? { ...m, saved: true } : m))
      onNoteSaved()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground">
            {noSources ? (
              <p className="text-sm">Add sources to start chatting.</p>
            ) : noneSelected ? (
              <p className="text-sm">Select at least one source to chat.</p>
            ) : (
              <p className="text-sm">Ask a question about your sources.</p>
            )}
          </div>
        )}

        {messages.map((msg, idx) => {
          const parsed = msg.role === 'assistant' ? parseContent(msg.content) : { body: msg.content, searchQuery: null, sourceFilenames: [] }
          const { body, searchQuery, sourceFilenames } = parsed
          return (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm">
                  {body}
                </div>
              ) : (
                <div className="max-w-[85%] space-y-2">
                  <div className="bg-card border px-4 py-3 rounded-2xl rounded-tl-sm">
                    {body ? (
                      <Markdown>{body}</Markdown>
                    ) : (
                      <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse rounded" />
                    )}
                  </div>
                  {(searchQuery || sourceFilenames.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-1">
                      {searchQuery && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
                          <Search size={10} />
                          {searchQuery}
                        </span>
                      )}
                      {sourceFilenames.map(fn => {
                        const src = sources.find(s => s.openragFilename === fn)
                        const title = src?.title ?? fn
                        const isUrl = src?.type === 'url'
                        const isPdf = src?.type === 'pdf'
                        const Icon = isPdf ? FileText : isUrl ? Globe : AlignLeft
                        return (
                          <span key={fn} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-foreground text-[11px] font-medium">
                            <Icon size={10} className="text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[150px]" title={title}>{title}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <SourceList openragSources={msg.sources} appSources={sources} />
                  )}
                  {msg.content && !streaming && (
                    <button onClick={() => saveAsNote(msg, messages[idx - 1]?.content ?? 'Chat response', idx)}
                      disabled={msg.saved}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed px-1">
                      <BookmarkPlus size={12} />
                      {msg.saved ? 'Saved' : 'Save to note'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-2 bg-destructive/10 text-destructive rounded text-xs flex items-center gap-2">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        {(noSources || noneSelected) && (
          <p className="text-xs text-muted-foreground mb-2 text-center">
            {noSources ? 'Add at least one source to enable chat.' : 'Check at least one source to chat.'}
          </p>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={disabled}
            placeholder={disabled ? '' : 'Ask a question… (Enter to send)'}
            rows={2}
            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none disabled:bg-muted disabled:cursor-not-allowed"
          />
          <button onClick={send} disabled={disabled || !input.trim()}
            className="self-end p-2.5 bg-primary text-primary-foreground rounded-lg disabled:opacity-40 hover:bg-primary/90">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
