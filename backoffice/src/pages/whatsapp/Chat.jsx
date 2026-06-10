import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'

const TEMPLATES = {
  cliente: {
    label: 'Mensaje a cliente',
    variables: [
      { key: '1', label: 'Nombre del cliente' },
      { key: '2', label: 'URL de cotización' },
    ],
  },
  transportista: {
    label: 'Mensaje a transportista',
    variables: [
      { key: '1', label: 'URL de cotización' },
    ],
  },
}

const STATUS_ICONS = {
  queued: '🕐',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '✕',
  received: '',
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export default function Chat() {
  const { phone } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showTemplate, setShowTemplate] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('cliente')
  const [templateVars, setTemplateVars] = useState({})
  const bottomRef = useRef(null)
  const pollRef = useRef(null)

  const decodedPhone = decodeURIComponent(phone)

  const load = () => {
    client.get(`/api/whatsapp/conversations/${encodeURIComponent(decodedPhone)}`)
      .then(({ data }) => {
        setMessages(data.messages)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 10000)
    return () => clearInterval(pollRef.current)
  }, [phone])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setError('')
    setSending(true)
    try {
      const { data } = await client.post('/api/whatsapp/send', { to: decodedPhone, body: body.trim() })
      setMessages((prev) => [...prev, data.message])
      setBody('')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const handleSendTemplate = async (e) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const { data } = await client.post('/api/whatsapp/send-template', {
        to: decodedPhone,
        template: selectedTemplate,
        variables: templateVars,
      })
      setMessages((prev) => [...prev, data.message])
      setShowTemplate(false)
      setTemplateVars({})
    } catch (err) {
      setError(err.response?.data?.message || 'Error al enviar plantilla')
    } finally {
      setSending(false)
    }
  }

  const displayName = messages[0]?.profile_name || decodedPhone

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 mb-4">
        <button
          onClick={() => navigate('/whatsapp')}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ←
        </button>
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
          {displayName[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{displayName}</p>
          <p className="text-xs text-gray-400">{decodedPhone}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 space-y-2">
        {loading && (
          <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">Sin mensajes</p>
        )}
        {messages.map((m) => {
          const isOut = m.direction === 'outbound'
          return (
            <div key={m.id || m.message_sid} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-2 text-sm ${
                  isOut
                    ? 'bg-teal-500 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
                }`}
              >
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {m.media_urls && (() => {
                  try {
                    const urls = JSON.parse(m.media_urls)
                    return urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className={`block text-xs underline mt-1 ${isOut ? 'text-teal-100' : 'text-teal-600'}`}
                      >
                        Adjunto {i + 1}
                      </a>
                    ))
                  } catch { return null }
                })()}
                <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${isOut ? 'text-teal-100' : 'text-gray-400'}`}>
                  <span>{formatTime(m.created_at)}</span>
                  {isOut && (
                    <span className={m.status === 'read' ? 'text-blue-200' : m.status === 'failed' ? 'text-red-300' : ''}>
                      {STATUS_ICONS[m.status] || ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Template panel */}
        {showTemplate ? (
          <form onSubmit={handleSendTemplate} className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Plantilla aprobada</span>
              <button type="button" onClick={() => { setShowTemplate(false); setTemplateVars({}) }}
                className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <select
              value={selectedTemplate}
              onChange={(e) => { setSelectedTemplate(e.target.value); setTemplateVars({}) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <option key={key} value={key}>{tpl.label}</option>
              ))}
            </select>
            {TEMPLATES[selectedTemplate].variables.map((v) => (
              <input
                key={v.key}
                type="text"
                placeholder={v.label}
                value={templateVars[v.key] || ''}
                onChange={(e) => setTemplateVars((prev) => ({ ...prev, [v.key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            ))}
            <button
              type="submit"
              disabled={sending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {sending ? '...' : 'Enviar plantilla'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowTemplate(true)}
            className="text-xs text-teal-600 hover:text-teal-800 font-medium"
          >
            + Usar plantilla aprobada
          </button>
        )}

        {/* Freeform */}
        <form onSubmit={handleSend}>
          <div className="flex gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
              }}
              placeholder="Escribe un mensaje libre (solo si escribió en las últimas 24h)..."
              rows={2}
              maxLength={1600}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-end"
            >
              {sending ? '...' : 'Enviar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{body.length}/1600 · Enter para enviar, Shift+Enter nueva línea</p>
        </form>
      </div>
    </div>
  )
}
