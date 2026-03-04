import { useState, useEffect } from 'react'
import { Workspace, AuthDialog } from '@/components'
import { useAuthStore, useAppStore } from '@/stores'
import { useOnlineStatus } from '@/hooks'
import { storageService } from '@/services'

// Toast notification component for API errors
function ToastNotification({ message, type, onClose }: { message: string; type: 'error' | 'warning'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])
  
  return (
    <div className={`fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right ${
      type === 'error' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
    }`}>
      <span>{message}</span>
      <button onClick={onClose} className="hover:opacity-70">✕</button>
    </div>
  )
}


export default function App() {
  const { isOnline } = useOnlineStatus()
  const [isInitialized, setIsInitialized] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' } | null>(null)
  
  const setOnlineStatus = useAppStore(state => state.setOnlineStatus)
  
  // Auth store
  const { isAuthenticated, login, register, checkAuth } = useAuthStore()
  
  // Listen for API error events
  useEffect(() => {
    const handleNetworkError = (e: CustomEvent<{ message: string }>) => {
      setToast({ message: e.detail.message, type: 'error' })
    }
    const handleServerError = (e: CustomEvent<{ message: string }>) => {
      setToast({ message: e.detail.message, type: 'warning' })
    }
    
    window.addEventListener('api:network-error', handleNetworkError as EventListener)
    window.addEventListener('api:server-error', handleServerError as EventListener)
    
    return () => {
      window.removeEventListener('api:network-error', handleNetworkError as EventListener)
      window.removeEventListener('api:server-error', handleServerError as EventListener)
    }
  }, [])
  
  // Initialize services on mount
  useEffect(() => {
    const initServices = async () => {
      await storageService.init()
      
      // Check auth and wait for result
      await checkAuth()
      
      setIsInitialized(true)
    }
    
    initServices()
    
    return () => {
      storageService.destroy()
    }
  }, []) // Remove checkAuth from deps to avoid re-running
  
  // Update online status in app store
  useEffect(() => {
    setOnlineStatus(isOnline)
  }, [isOnline, setOnlineStatus])
  
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }
  
  // If not authenticated, show only auth dialog with a blank/blurred background
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--muted)/0.3)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <AuthDialog
          isOpen={true}
          onClose={() => {}}
          onLogin={async (email, password) => {
            await login(email, password)
          }}
          onRegister={async (name, email, password) => {
            await register({ email, password, username: name, fullName: name })
          }}
        />
      </div>
    )
  }
  
  return (
    <>
      <Workspace />
      {toast && (
        <ToastNotification 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </>
  )
}
