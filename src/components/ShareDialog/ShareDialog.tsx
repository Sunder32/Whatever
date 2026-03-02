import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  X, 
  Globe, 
  Lock, 
  UserPlus, 
  Link2, 
  Check,
  Trash2,
  Crown,
  Pencil,
  Eye,
  Loader2,
  ChevronDown,
  Shield,
  Mail
} from 'lucide-react'
import { useDiagramStore, useAuthStore } from '@/stores'
import { collaborationApi } from '@/api'
import { cn } from '@/utils'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
}

type Permission = 'owner' | 'admin' | 'write' | 'read'

interface Collaborator {
  id: string
  userId: string
  email: string
  name: string
  avatarUrl?: string
  permission: Permission
  status: 'active' | 'pending'
  addedAt: string
}

/* ─── Custom dropdown for role selection ─── */
function RoleDropdown({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: Permission
  onChange: (v: 'read' | 'write' | 'admin') => void
  disabled?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const roles: { value: 'read' | 'write' | 'admin'; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'read', label: 'Просмотр', icon: <Eye size={14} />, desc: 'Может только просматривать' },
    { value: 'write', label: 'Редактор', icon: <Pencil size={14} />, desc: 'Может редактировать схему' },
    { value: 'admin', label: 'Админ', icon: <Shield size={14} />, desc: 'Полный доступ к настройкам' },
  ]

  const current = roles.find(r => r.value === value) || roles[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 transition-colors',
          'hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-primary outline-none',
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {current.icon}
        <span>{current.label}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border bg-popover shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
          {roles.map(role => (
            <button
              key={role.value}
              onClick={() => { onChange(role.value); setOpen(false) }}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent/60 transition-colors',
                role.value === value && 'bg-accent/40'
              )}
            >
              <span className="mt-0.5 text-muted-foreground">{role.icon}</span>
              <div>
                <p className="text-sm font-medium">{role.label}</p>
                <p className="text-xs text-muted-foreground">{role.desc}</p>
              </div>
              {role.value === value && <Check size={14} className="ml-auto mt-0.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const file = useDiagramStore(state => state.file)
  const { user } = useAuthStore()
  
  const [isPublic, setIsPublic] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePermission, setInvitePermission] = useState<'read' | 'write' | 'admin'>('read')
  const [isInviting, setIsInviting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (isOpen && file && file.projectId) {
      setShareLink(collaborationApi.generateShareLink(file.projectId))
      loadCollaborators()
    }
  }, [isOpen, file])
  
  const loadCollaborators = useCallback(async () => {
    if (!file || !file.projectId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const apiCollabs = await collaborationApi.getCollaborators(file.projectId)
      
      const collabs: Collaborator[] = apiCollabs.map(c => ({
        id: c.id,
        userId: c.userId || c.id,
        email: c.email,
        name: c.name,
        avatarUrl: c.avatar,
        permission: c.permission as Permission,
        status: 'active',
        addedAt: c.createdAt || new Date().toISOString(),
      }))
      
      if (user && !collabs.find(c => c.permission === 'owner')) {
        collabs.unshift({
          id: 'owner',
          userId: user.id,
          email: user.email,
          name: user.fullName || 'Вы',
          permission: 'owner',
          status: 'active',
          addedAt: new Date().toISOString(),
        })
      }
      
      setCollaborators(collabs)
    } catch (err) {
      console.error('Failed to load collaborators:', err)
      if (user) {
        setCollaborators([{
          id: 'owner',
          userId: user.id,
          email: user.email,
          name: user.fullName || 'Вы',
          permission: 'owner',
          status: 'active',
          addedAt: new Date().toISOString(),
        }])
      }
    } finally {
      setIsLoading(false)
    }
  }, [file, user])
  
  const handleCopyLink = () => {
    // navigator.clipboard is undefined on non-HTTPS origins
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareLink)
    } else {
      // Fallback for HTTP: use a temporary textarea
      const ta = document.createElement('textarea')
      ta.value = shareLink
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !file || !file.projectId) return
    
    setIsInviting(true)
    setError(null)
    
    try {
      const newCollab = await collaborationApi.addCollaborator(file.projectId, {
        email: inviteEmail,
        permission: invitePermission,
      })
      
      setCollaborators(prev => [...prev, {
        id: newCollab.id,
        userId: newCollab.userId || newCollab.id,
        email: newCollab.email,
        name: newCollab.name,
        avatarUrl: newCollab.avatar,
        permission: newCollab.permission as Permission,
        status: 'active',
        addedAt: new Date().toISOString(),
      }])
      setInviteEmail('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось добавить пользователя')
    } finally {
      setIsInviting(false)
    }
  }
  
  const handleRemoveCollaborator = async (id: string, userId: string) => {
    if (!file || !file.projectId || id === 'owner') return
    
    try {
      await collaborationApi.removeCollaborator(file.projectId, userId)
      setCollaborators(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error('Failed to remove collaborator:', err)
    }
  }
  
  const handleChangePermission = async (id: string, userId: string, permission: 'read' | 'write' | 'admin') => {
    if (!file || !file.projectId || id === 'owner') return
    
    try {
      await collaborationApi.updateCollaborator(file.projectId, userId, permission)
      setCollaborators(prev => prev.map(c => 
        c.id === id ? { ...c, permission } : c
      ))
    } catch (err) {
      console.error('Failed to update collaborator:', err)
    }
  }
  
  const handleTogglePublic = async () => {
    if (!file || !file.projectId) return
    
    try {
      await collaborationApi.setVisibility(file.projectId, !isPublic)
      setIsPublic(!isPublic)
    } catch (err) {
      console.error('Failed to update visibility:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inviteEmail.trim()) {
      handleInvite()
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in-0 duration-150">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-popover border border-border/60 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h2 className="text-base font-semibold">Настройки доступа</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* ─── Body ─── */}
        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ── Visibility toggle ── */}
          <div 
            className={cn(
              'flex items-center justify-between p-3.5 rounded-lg border transition-colors cursor-pointer',
              isPublic 
                ? 'bg-emerald-500/5 border-emerald-500/20' 
                : 'bg-secondary/30 border-border/40'
            )}
            onClick={handleTogglePublic}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex items-center justify-center w-9 h-9 rounded-lg',
                isPublic ? 'bg-emerald-500/15 text-emerald-500' : 'bg-orange-500/15 text-orange-500'
              )}>
                {isPublic ? <Globe size={18} /> : <Lock size={18} />}
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">
                  {isPublic ? 'Публичная схема' : 'Приватная схема'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPublic 
                    ? 'Любой с ссылкой может просматривать' 
                    : 'Только приглашённые пользователи'
                  }
                </p>
              </div>
            </div>
            {/* Toggle switch */}
            <div
              role="switch"
              aria-checked={isPublic}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                isPublic ? 'bg-emerald-500' : 'bg-muted-foreground/30'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm',
                'transition-transform duration-200 ease-in-out',
                isPublic && 'translate-x-5'
              )} />
            </div>
          </div>
          
          {/* ── Share link ── */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Ссылка для доступа
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border/40">
                <Link2 size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-foreground/80 outline-none truncate select-all"
                />
              </div>
              <button
                onClick={handleCopyLink}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all duration-200 flex-shrink-0',
                  copied 
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' 
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {copied ? <Check size={14} /> : <Link2 size={14} />}
                {copied ? 'Скопировано!' : 'Копировать'}
              </button>
            </div>
          </div>
          
          {/* ── Invite ── */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Пригласить
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border/40 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all">
                <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="email@example.com"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <RoleDropdown 
                value={invitePermission} 
                onChange={setInvitePermission} 
              />
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isInviting}
                className={cn(
                  'p-2 rounded-lg bg-primary text-primary-foreground transition-all flex-shrink-0',
                  'hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed'
                )}
              >
                {isInviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              </button>
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive mt-2">
                <span className="w-1 h-1 rounded-full bg-destructive flex-shrink-0" />
                {error}
              </p>
            )}
          </div>
          
          {/* ── Collaborators ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Участники
              </label>
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {collaborators.length}
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-0.5 max-h-52 overflow-y-auto rounded-lg border border-border/40">
                {collaborators.map((collab, idx) => (
                  <div 
                    key={collab.id}
                    className={cn(
                      'flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-accent/30',
                      idx !== collaborators.length - 1 && 'border-b border-border/20'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar 
                        src={collab.avatarUrl} 
                        name={collab.name} 
                        size="sm" 
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight truncate flex items-center gap-1.5">
                          {collab.name}
                          {collab.userId === user?.id && (
                            <span className="text-[10px] text-muted-foreground font-normal">(вы)</span>
                          )}
                          {collab.status === 'pending' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-500">
                              ожидает
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{collab.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {collab.permission === 'owner' ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Crown size={12} />
                          Владелец
                        </span>
                      ) : (
                        <>
                          <RoleDropdown
                            value={collab.permission}
                            onChange={(p) => handleChangePermission(collab.id, collab.userId, p)}
                            compact
                          />
                          <button
                            onClick={() => handleRemoveCollaborator(collab.id, collab.userId)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Удалить участника"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* ─── Footer ─── */}
        <div className="px-5 py-3 border-t border-border/40 bg-secondary/20">
          <p className="text-[11px] text-muted-foreground/60 text-center">
            Приглашённые пользователи получат уведомление со ссылкой для доступа
          </p>
        </div>
      </div>
    </div>
  )
}
