import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'

export default function Conversations() {
  const [conversations, setConversations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [newPhone, setNewPhone] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const navigate = useNavigate()

  const handleNewChat = (e) => {
    e.preventDefault()
    const phone = newPhone.trim()
    if (!phone) return
    navigate(`/whatsapp/${encodeURIComponent(phone)}`)
  }

  const load = (q = '') => {
    setLoading(true)
    client.get('/api/whatsapp/conversations', { params: q ? { q } : {} })
      .then(({ data }) => setConversations(data.conversations))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    load(search)
  }

  const TZ = 'America/Lima'

  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    const todayStr = new Date().toLocaleDateString('es-PE', { timeZone: TZ })
    const dStr = d.toLocaleDateString('es-PE', { timeZone: TZ })
    if (dStr === todayStr) {
      return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
    }
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', timeZone: TZ })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <button
          onClick={() => setShowNewChat((v) => !v)}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva conversación
        </button>
      </div>

      {showNewChat && (
        <form onSubmit={handleNewChat} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Número con código de país, ej: +51987654321"
            autoFocus
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Ir al chat
          </button>
          <button
            type="button"
            onClick={() => { setShowNewChat(false); setNewPhone('') }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Cancelar
          </button>
        </form>
      )}

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número o nombre..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); load() }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Limpiar
          </button>
        )}
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">Cargando...</div>
        )}
        {!loading && conversations.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">No hay conversaciones</div>
        )}
        {!loading && conversations.map((c) => (
          <button
            key={c.contact_number}
            onClick={() => navigate(`/whatsapp/${encodeURIComponent(c.contact_number)}`)}
            className="w-full flex items-start gap-3 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 text-left transition-colors"
          >
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${c.channel === 'web' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {(c.profile_name || c.contact_number || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium text-gray-900 text-sm truncate">
                    {c.customer_name || c.profile_name || (c.channel === 'web' ? 'Chat web' : c.contact_number)}
                  </span>
                  {c.channel === 'web' && (
                    <span className="shrink-0 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">Web</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 ml-2 shrink-0">{formatDate(c.last_message_at)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{c.contact_number}</p>
              <p className="text-sm text-gray-500 truncate mt-0.5">
                {c.direction === 'outbound' && <span className="text-teal-500 mr-1">Tú:</span>}
                {c.last_message_body || '(sin texto)'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
