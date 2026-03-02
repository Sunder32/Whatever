import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Lock, Unlock, Eye, EyeOff, Shield, Loader2, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/api'
import { cn } from '@/utils'

interface EncryptionDialogProps {
  isOpen: boolean
  onClose: () => void
  isEncrypted: boolean
  schemaContent: Record<string, unknown> | null
  onEncrypted?: (encryptedContent: Record<string, unknown>) => void
  onDecrypted?: (decryptedContent: Record<string, unknown>) => void
}

export function EncryptionDialog({
  isOpen,
  onClose,
  isEncrypted,
  schemaContent,
  onEncrypted,
  onDecrypted,
}: EncryptionDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEncrypt = async () => {
    if (!schemaContent) return
    if (password.length < 6) {
      setError(t('encryption.passwordTooShort', 'Password must be at least 6 characters'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('encryption.passwordMismatch', 'Passwords do not match'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.post<{ data: Record<string, unknown> }>('/export/encrypt', {
        content: schemaContent,
        password,
      })
      if ((result as any).success !== false && (result as any).data) {
        onEncrypted?.((result as any).data)
        onClose()
      } else {
        setError((result as any).error || 'Encryption failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleDecrypt = async () => {
    if (!schemaContent) return
    if (!password) {
      setError(t('encryption.enterPassword', 'Please enter the password'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.post<{ data: Record<string, unknown> }>('/export/decrypt', {
        content: schemaContent,
        password,
      })
      if ((result as any).success !== false && (result as any).data) {
        onDecrypted?.((result as any).data)
        onClose()
      } else {
        setError((result as any).error || 'Decryption failed — wrong password?')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const resetState = () => {
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setShowPassword(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield size={20} />
            <h2 className="text-lg font-semibold">
              {isEncrypted
                ? t('encryption.decryptTitle', 'Decrypt Schema')
                : t('encryption.encryptTitle', 'Encrypt Schema')}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded hover:bg-accent">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div className={cn(
            'flex items-start gap-3 p-3 rounded-lg text-sm',
            isEncrypted ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
          )}>
            {isEncrypted ? <Lock size={18} className="mt-0.5 shrink-0" /> : <Unlock size={18} className="mt-0.5 shrink-0" />}
            <div>
              {isEncrypted ? (
                <p>{t('encryption.decryptInfo', 'This schema is encrypted with AES-256-GCM. Enter the password to decrypt.')}</p>
              ) : (
                <p>{t('encryption.encryptInfo', 'Protect your schema with a password. Uses AES-256-GCM encryption.')}</p>
              )}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {t('encryption.password', 'Password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                placeholder={t('encryption.passwordPlaceholder', 'Enter password...')}
                className="w-full px-3 py-2 pr-10 text-sm bg-secondary rounded border-0 outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password (encrypt only) */}
          {!isEncrypted && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {t('encryption.confirmPassword', 'Confirm Password')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(null) }}
                placeholder={t('encryption.confirmPlaceholder', 'Repeat password...')}
                className="w-full px-3 py-2 text-sm bg-secondary rounded border-0 outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Warning */}
          {!isEncrypted && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>{t('encryption.warning', 'If you forget the password, the data cannot be recovered. Make sure to remember it.')}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-3">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded hover:bg-accent transition-colors"
            >
              {t('dialogs.cancel', 'Cancel')}
            </button>
            <button
              onClick={isEncrypted ? handleDecrypt : handleEncrypt}
              disabled={loading || !password}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm rounded transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isEncrypted ? (
                <Unlock size={16} />
              ) : (
                <Lock size={16} />
              )}
              {isEncrypted
                ? t('encryption.decryptButton', 'Decrypt')
                : t('encryption.encryptButton', 'Encrypt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
