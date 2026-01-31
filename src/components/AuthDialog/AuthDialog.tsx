import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { cn } from '@/utils'

interface AuthDialogProps {
  isOpen: boolean
  onClose: () => void
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (name: string, email: string, password: string) => Promise<void>
}

type AuthMode = 'login' | 'register'

export function AuthDialog({ isOpen, onClose, onLogin, onRegister }: AuthDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  if (!isOpen) return null
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    try {
      if (mode === 'login') {
        await onLogin(email, password)
      } else {
        if (password !== confirmPassword) {
          setError(t('auth.passwordMismatch'))
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError(t('auth.passwordTooShort'))
          setLoading(false)
          return
        }
        await onRegister(name, email, password)
      }
      onClose()
    } catch (err) {
      setError(t('auth.error'))
    } finally {
      setLoading(false)
    }
  }
  
  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {mode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
            {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-sm font-medium mb-1 block">{t('auth.name')}</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.namePlaceholder')}
                  required
                  className="w-full pl-10 pr-3 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
          
          <div>
            <label className="text-sm font-medium mb-1 block">{t('auth.email')}</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                className="w-full pl-10 pr-3 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">{t('auth.password')}</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
                className="w-full pl-10 pr-10 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          
          {mode === 'register' && (
            <div>
              <label className="text-sm font-medium mb-1 block">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  required
                  className="w-full pl-10 pr-3 py-2 text-sm bg-secondary rounded-lg border-0 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg transition-colors',
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
            )}
          >
            {loading ? '...' : mode === 'login' ? t('auth.loginButton') : t('auth.registerButton')}
          </button>
          
          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
            </span>
            {' '}
            <button
              type="button"
              onClick={switchMode}
              className="text-primary hover:underline"
            >
              {mode === 'login' ? t('auth.registerLink') : t('auth.loginLink')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
