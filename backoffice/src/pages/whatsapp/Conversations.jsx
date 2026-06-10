import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'

export default function Conversations() {
  const [conversations, setConversations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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

  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <span className="text-sm text-gray-400">{conversations.length} conversaciones</span>
      </div>

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
            <div className="shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-lg">
              {(c.profile_name || c.contact_number || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 text-sm truncate">
                  {c.customer_name || c.profile_name || c.contact_number}
                </span>
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
