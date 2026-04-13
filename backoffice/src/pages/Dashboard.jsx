import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../contexts/AuthContext'

function StatCard({ label, value, to }) {
  return (
    <Link to={to} className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value ?? '—'}</p>
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ companies: null, users: null })

  useEffect(() => {
    client.get('/api/carrier-companies').then(({ data }) => {
      setStats((s) => ({ ...s, companies: data.carrier_companies.length }))
    })
    if (user?.role === 'superadmin') {
      client.get('/api/users').then(({ data }) => {
        setStats((s) => ({ ...s, users: data.users.length }))
      })
    }
  }, [user])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Empresas transportistas" value={stats.companies} to="/carrier-companies" />
        {user?.role === 'superadmin' && (
          <StatCard label="Usuarios admin" value={stats.users} to="/users" />
        )}
      </div>
    </div>
  )
}
