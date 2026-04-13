import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('bo_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bo_token')
      localStorage.removeItem('bo_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default client
