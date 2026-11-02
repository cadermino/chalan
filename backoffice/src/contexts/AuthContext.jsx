import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('bo_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Etiqueta la sesión de Clarity con el rol, para filtrar las grabaciones de
  // admins y de transportistas por separado. Solo el rol: nada que identifique
  // a la persona. `window.clarity` existe solo en producción (main.jsx); antes
  // de que cargue el script, el stub encola la llamada.
  useEffect(() => {
    window.clarity?.('set', 'role', user?.role || 'anonymous')
  }, [user?.role])

  // La respuesta del login o del link para crear contraseña: { token, user }.
  const startSession = useCallback((data) => {
    localStorage.setItem('bo_token', data.token)
    localStorage.setItem('bo_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password })
    return startSession(data)
  }, [startSession])

  const logout = useCallback(() => {
    localStorage.removeItem('bo_token')
    localStorage.removeItem('bo_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, startSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
