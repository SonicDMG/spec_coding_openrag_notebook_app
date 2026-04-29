'use client'

import { useState, useRef, useEffect } from 'react'
import Markdown from '@/components/Markdown'
import { Send, BookmarkPlus, AlertCircle } from 'lucide-react'
import type { Source } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: { title: string; filename: string }[]
  saved?: boolean
}

interface Props {
  notebookId: string
  sources: Source[]
  selectedIds: Set<string>
  onNoteSaved: () => void
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

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[80%] bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[85%] space-y-2">
                <div className="bg-card border px-4 py-3 rounded-2xl rounded-tl-sm">
                  {msg.content ? (
                    <Markdown>{msg.content}</Markdown>
                  ) : (
                    <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse rounded" />
                  )}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {msg.sources.map((s, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{s.title}</span>
                    ))}
                  </div>
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
        ))}
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
