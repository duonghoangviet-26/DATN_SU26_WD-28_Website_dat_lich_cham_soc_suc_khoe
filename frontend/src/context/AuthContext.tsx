import { createContext, useContext, useEffect, useState } from 'react'
import { authService } from '@/services/auth.service'
import type { User } from '@/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (credentials: { email: string; password: string }) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthContextType['user']>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  async function login(credentials: { email: string; password: string }) {
    const { token, user: loggedUser } = await authService.login(credentials)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(loggedUser))
    setUser(loggedUser)
    return loggedUser
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const value: AuthContextType = { user, loading, login, logout, isAuthenticated: !!user }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook tiện dụng: const { user, login, logout } = useAuth()
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return ctx
}
