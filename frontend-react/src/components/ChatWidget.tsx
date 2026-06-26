'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
const SESSION_KEY = 'chalan_chat_session'
const POLL_INTERVAL = 5000
const AUTO_OPEN_DELAY = 4000

interface Message {
  id: number | string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  created_at: string
}

const PHANTOM_MESSAGE: Message = {
  id: '__phantom__',
  direction: 'outbound',
  body: '¡Hola! 👋 ¿Tienes dudas sobre tu mudanza o flete? Escríbenos y te ayudamos.',
  status: 'received',
  created_at: new Date().toISOString(),
}

function getOrCreateSession(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id || !/^[a-z0-9]{12}$/.test(id)) {
      id = Math.random().toString(36).slice(2, 14).padEnd(12, '0')
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return Math.random().toString(36).slice(2, 14).padEnd(12, '0')
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export function ChatWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [seenCount, setSeenCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasUnread = !open && messages.filter((m) => m.direction === 'outbound').length > seenCount

  useEffect(() => {
    setSessionId(getOrCreateSession())
    if (pathname === '/') return
    const t = setTimeout(() => setOpen(true), AUTO_OPEN_DELAY)
    return () => clearTimeout(t)
  }, [pathname])

  const fetchMessages = (sid: string) => {
    fetch(`${API_BASE}/api/v1/chat/messages/${sid}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.messages)) setMessages(d.messages) })
      .catch(() => {})
  }

  useEffect(() => {
    if (!sessionId || !open) return
    fetchMessages(sessionId)
    pollRef.current = setInterval(() => fetchMessages(sessionId), POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [sessionId, open])

  useEffect(() => {
    if (open) setSeenCount(messages.filter((m) => m.direction === 'outbound').length)
  }, [open, messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 100)
  }, [open])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || !sessionId) return
    setError('')
    setSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, body: body.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al enviar'); return }
      setMessages((prev) => [...prev, data.message])
      setBody('')
    } catch {
      setError('Error al enviar. Intenta de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir chat de soporte"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-colors sm:flex"
        style={{ background: '#2fa55f' }}
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z" clipRule="evenodd" />
          </svg>
        )}
        {!open && (
          <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold leading-none">
            1
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl border-t border-gray-200 rounded-t-2xl sm:inset-x-auto sm:bottom-24 sm:right-5 sm:w-96 sm:rounded-2xl sm:border" style={{ maxHeight: '85vh' }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#2fa55f' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'rgba(255,255,255,0.2)' }}>C</div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Chalán - Soporte</p>
              <p className="text-xs" style={{ color: '#bbf7d0' }}>Te respondemos pronto</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white opacity-70 hover:opacity-100 text-xl leading-none p-1">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {(messages.length === 0 ? [PHANTOM_MESSAGE] : messages).map((m) => {
              const isUser = m.direction === 'inbound'
              return (
                <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isUser ? 'text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm'}`} style={isUser ? { background: '#2fa55f' } : {}}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-xs mt-1 text-right ${isUser ? '' : 'text-gray-400'}`} style={isUser ? { color: 'rgba(255,255,255,0.7)' } : {}}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white px-3 py-3">
            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
            <form onSubmit={handleSend} className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent) }
                }}
                placeholder="Escribe tu mensaje..."
                rows={1}
                maxLength={1000}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors self-end disabled:opacity-40"
                style={{ background: '#2fa55f' }}
              >
                {sending ? '...' : '→'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
