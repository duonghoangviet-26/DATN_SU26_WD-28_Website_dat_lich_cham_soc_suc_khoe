import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'
const THEME_KEY = 'vf_chat_theme'

export function useChatTheme() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_KEY) as Theme
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setTheme(storedTheme)
      } else {
        // Fallback to system preference if no stored theme
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          setTheme('dark')
        }
      }
    } catch (e) {
      console.error('Lỗi khi đọc theme:', e)
    }
  }, [])

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem(THEME_KEY, newTheme)
      } catch (e) {
        console.error('Lỗi khi lưu theme:', e)
      }
      return newTheme
    })
  }

  return { theme, isDark: theme === 'dark', toggleTheme }
}
