'use client'

import { useEffect, useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface ToastMessage {
  id: string
  message: string
  type: 'error' | 'success' | 'info'
}

let toastQueue: ToastMessage[] = []
let listeners: Array<(messages: ToastMessage[]) => void> = []

export function showError(message: string) {
  const toast: ToastMessage = { id: Date.now().toString(), message, type: 'error' }
  toastQueue = [...toastQueue, toast]
  listeners.forEach(fn => fn(toastQueue))
  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t.id !== toast.id)
    listeners.forEach(fn => fn(toastQueue))
  }, 5000)
}

export function showSuccess(message: string) {
  const toast: ToastMessage = { id: Date.now().toString(), message, type: 'success' }
  toastQueue = [...toastQueue, toast]
  listeners.forEach(fn => fn(toastQueue))
  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t.id !== toast.id)
    listeners.forEach(fn => fn(toastQueue))
  }, 3000)
}

export default function ErrorToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  useEffect(() => {
    const listener = (msgs: ToastMessage[]) => setMessages(msgs)
    listeners.push(listener)
    return () => { listeners = listeners.filter(l => l !== listener) }
  }, [])

  if (messages.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border animate-in slide-in-from-bottom-5 ${
            msg.type === 'error'
              ? 'bg-destructive/10 text-destructive border-destructive/20'
              : msg.type === 'success'
              ? 'bg-green-50 text-green-900 border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-800'
              : 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800'
          }`}
        >
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="flex-1 text-sm font-medium">{msg.message}</p>
          <button
            onClick={() => {
              toastQueue = toastQueue.filter(t => t.id !== msg.id)
              listeners.forEach(fn => fn(toastQueue))
            }}
            className="shrink-0 p-0.5 hover:opacity-70 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
