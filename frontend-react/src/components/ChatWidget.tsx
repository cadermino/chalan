'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Agente de cotización (LLM).
// Contrato: POST { tenantId, sessionId, message } -> { messages: [{ type, text }] }
const AGENT_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || 'https://api.agente.chalan.pe/chat/message'
const TENANT_ID = process.env.NEXT_PUBLIC_CHAT_TENANT_ID || ''

const SESSION_KEY = 'chalan_chat_session'
const HISTORY_KEY = 'chalan_chat_history'
const AUTO_OPEN_DELAY = 4000

interface Message {
  id: string
  role: 'user' | 'agent'
  body: string
  created_at: string
}

const PHANTOM_MESSAGES: Record<string, string> = {
  '/embalaje-profesional': '¡Hola! 👋 ¿Tienes dudas sobre el servicio de embalaje? Cuéntanos qué necesitas embalar y te cotizamos.',
}
const DEFAULT_PHANTOM = '¡Hola! 👋 ¿Tienes dudas sobre tu mudanza o flete? Escríbenos y te ayudamos.'

function getPhantomMessage(pathname: string): Message {
  return {
    id: '__phantom__',
    role: 'agent',
    body: PHANTOM_MESSAGES[pathname] ?? DEFAULT_PHANTOM,
    created_at: new Date().toISOString(),
  }
}

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function getOrCreateSession(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = newId()
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return newId()
  }
}

function loadHistory(sid: string): Message[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY}:${sid}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(sid: string, messages: Message[]) {
  try {
    localStorage.setItem(`${HISTORY_KEY}:${sid}`, JSON.stringify(messages))
  } catch {
    /* storage full or unavailable — ignore */
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasUnread = !open && messages.filter((m) => m.role === 'agent').length > seenCount

  // Bootstrap session + restore visible history from localStorage.
  useEffect(() => {
    const sid = getOrCreateSession()
    setSessionId(sid)
    setMessages(loadHistory(sid))
    const NO_AUTOOPEN = ['/', '/embalaje-profesional']
    if (NO_AUTOOPEN.includes(pathname) || window.innerWidth < 640) return
    const t = setTimeout(() => setOpen(true), AUTO_OPEN_DELAY)
    return () => clearTimeout(t)
  }, [pathname])

  // Persist visible history so the conversation survives reloads.
  useEffect(() => {
    if (sessionId) saveHistory(sessionId, messages)
  }, [sessionId, messages])

  useEffect(() => {
    if (open) setSeenCount(messages.filter((m) => m.role === 'agent').length)
  }, [open, messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, sending])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 100)
  }, [open])

  const resetConversation = () => {
    const sid = newId()
    try {
      localStorage.setItem(SESSION_KEY, sid)
      localStorage.removeItem(`${HISTORY_KEY}:${sessionId}`)
    } catch {
      /* ignore */
    }
    setSessionId(sid)
    setMessages([])
    setError('')
    setSeenCount(0)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = body.trim()
    // Una sola request en vuelo por sessionId (envíos concurrentes -> 500).
    if (!text || !sessionId || sending) return

    setError('')
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', body: text, created_at: new Date().toISOString() },
    ])
    setBody('')
    setSending(true)

    try {
      const res = await fetch(AGENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, sessionId, message: text }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('ChatWidget agent error:', res.status, err)
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      // El contrato manda un array de mensajes (texto o imagen); acá solo usamos
      // texto (mudanzas no manda fotos). Cada elemento puede traer varios párrafos
      // separados por "\n\n" -> burbujas.
      const apiMessages = (data.messages ?? []) as Array<{ type: string; text?: string }>
      const bubbles = apiMessages.flatMap((m) =>
        m.type === 'text' && m.text
          ? m.text.split('\n\n').map((s) => s.trim()).filter(Boolean)
          : []
      )

      setMessages((prev) => [
        ...prev,
        ...bubbles.map((b: string) => ({
          id: newId(),
          role: 'agent' as const,
          body: b,
          created_at: new Date().toISOString(),
        })),
      ])
    } catch (err) {
      console.error(err)
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'agent',
          body: 'Ups, tuvimos un problema. Inténtalo de nuevo en un momento.',
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  // La landing de transportistas ya tiene su propio CTA de registro; el widget de cotización no aplica ahí.
  if (pathname === '/transportistas') return null

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
        {hasUnread && (
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
              <p className="text-white font-semibold text-sm">Chalán - Asistente</p>
              <p className="text-xs" style={{ color: '#bbf7d0' }}>Te respondemos al instante</p>
            </div>
            <button onClick={resetConversation} aria-label="Reiniciar conversación" title="Reiniciar conversación" className="text-white opacity-70 hover:opacity-100 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={() => setOpen(false)} aria-label="Cerrar chat" className="text-white opacity-70 hover:opacity-100 text-xl leading-none p-1">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {(messages.length === 0 ? [getPhantomMessage(pathname)] : messages).map((m) => {
              const isUser = m.role === 'user'
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
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 bg-white border border-gray-200 shadow-sm">
                  <span className="flex gap-1 items-center h-4" aria-label="Escribiendo…">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
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
                maxLength={4096}
                disabled={sending}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none disabled:bg-gray-100"
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
