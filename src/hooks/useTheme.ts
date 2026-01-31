import { useEffect } from 'react'
import { useAppStore } from '@/stores'

type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const preferences = useAppStore(state => state.preferences)
  const updatePreferences = useAppStore(state => state.updatePreferences)
  
  const theme = preferences.theme as Theme
  
  useEffect(() => {
    const root = window.document.documentElement
    
    const applyTheme = (theme: Theme) => {
      root.classList.remove('light', 'dark')
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        root.classList.add(systemTheme)
      } else {
        root.classList.add(theme)
      }
    }
    
    applyTheme(theme)
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])
  
  const setTheme = (newTheme: Theme) => {
    updatePreferences({ theme: newTheme })
    localStorage.setItem('diagram-app-theme', newTheme)
  }
  
  // Load saved theme on init
  useEffect(() => {
    const savedTheme = localStorage.getItem('diagram-app-theme') as Theme | null
    if (savedTheme) {
      updatePreferences({ theme: savedTheme })
    }
  }, [])
  
  return { theme, setTheme }
}
