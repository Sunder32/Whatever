import { useState, useEffect } from 'react'
import { 
  X, 
  Globe, 
  Lock, 
  Users, 
  UserPlus, 
  Copy, 
  Check,
  Trash2,
  Crown,
  Edit,
  Eye,
  Loader2
} from 'lucide-react'
import { useDiagramStore, useAuthStore } from '@/stores'
import { collaborationApi } from '@/api'
import { cn } from '@/utils'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
}

type Permission = 'owner' | 'admin' | 'write' | 'read'

interface Collaborator {
  id: string
  email: string
  name: string
  avatarUrl?: string
  permission: Permission
  status: 'active' | 'pending'
  addedAt: string
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
      // Generate share link
      setShareLink(collaborationApi.generateShareLink(file.projectId))
      
      // Load collaborators
      loadCollaborators()
    }
  }, [isOpen, file])
  
  const loadCollaborators = async () => {
    if (!file || !file.projectId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const apiCollabs = await collaborationApi.getCollaborators(file.projectId)
      
      // Convert API response to local format
      const collabs: Collaborator[] = apiCollabs.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name,
        avatarUrl: c.avatar,
        permission: c.permission as Permission,
        status: 'active',
        addedAt: c.createdAt || new Date().toISOString(),
      }))
      
      // Add owner if not in list
      if (user && !collabs.find(c => c.permission === 'owner')) {
        collabs.unshift({
          id: 'owner',
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
      // If API fails, show owner at least
      if (user) {
        setCollaborators([{
          id: 'owner',
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
  }
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink)
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
      
      setCollaborators([...collaborators, {
        id: newCollab.id,
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
      setCollaborators(collaborators.filter(c => c.id !== id))
    } catch (err) {
      console.error('Failed to remove collaborator:', err)
    }
  }
  
  const handleChangePermission = async (id: string, userId: string, permission: 'read' | 'write' | 'admin') => {
    if (!file || !file.projectId || id === 'owner') return
    
    try {
      await collaborationApi.updateCollaborator(file.projectId, userId, permission)
      setCollaborators(collaborators.map(c => 
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
  
  const getPermissionIcon = (permission: Permission) => {
    switch (permission) {
      case 'owner': return <Crown size={14} className="text-yellow-500" />
      case 'admin': return <Crown size={14} className="text-purple-500" />
      case 'write': return <Edit size={14} className="text-blue-500" />
      case 'read': return <Eye size={14} className="text-gray-500" />
    }
  }
  
  const getPermissionLabel = (permission: Permission) => {
    switch (permission) {
      case 'owner': return 'Владелец'
      case 'admin': return 'Админ'
      case 'write': return 'Редактор'
      case 'read': return 'Просмотр'
    }
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users size={20} />
            Настройки доступа
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Visibility toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe size={24} className="text-green-500" />
              ) : (
                <Lock size={24} className="text-orange-500" />
              )}
              <div>
                <p className="font-medium">
                  {isPublic ? 'Публичная схема' : 'Приватная схема'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPublic 
                    ? 'Любой с ссылкой может просматривать' 
                    : 'Только приглашённые пользователи'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleTogglePublic}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                isPublic ? 'bg-green-500' : 'bg-gray-600'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                isPublic ? 'translate-x-6' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          
          {/* Share link */}
          <div>
            <label className="block text-sm font-medium mb-2">Ссылка для доступа</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border text-sm"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
          
          {/* Invite collaborators */}
          <div>
            <label className="block text-sm font-medium mb-2">Пригласить пользователей</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border text-sm focus:ring-2 focus:ring-primary outline-none"
              />
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value as 'read' | 'write' | 'admin')}
                className="px-3 py-2 rounded-lg bg-secondary border text-sm"
              >
                <option value="read">Просмотр</option>
                <option value="write">Редактор</option>
                <option value="admin">Админ</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isInviting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {isInviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              </button>
            </div>
            {error && (
              <p className="text-sm text-destructive mt-2">{error}</p>
            )}
          </div>
          
          {/* Collaborators list */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Участники ({collaborators.length})
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
            <div className="space-y-2 max-h-48 overflow-auto">
              {collaborators.map(collab => (
                <div 
                  key={collab.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                      {collab.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {collab.name}
                        {collab.status === 'pending' && (
                          <span className="text-xs text-yellow-500">(ожидает)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{collab.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {collab.permission === 'owner' ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-500">
                        {getPermissionIcon(collab.permission)}
                        {getPermissionLabel(collab.permission)}
                      </span>
                    ) : (
                      <>
                        <select
                          value={collab.permission}
                          onChange={(e) => handleChangePermission(collab.id, collab.id, e.target.value as 'read' | 'write' | 'admin')}
                          className="px-2 py-1 rounded bg-secondary border text-xs"
                        >
                          <option value="read">Просмотр</option>
                          <option value="write">Редактор</option>
                          <option value="admin">Админ</option>
                        </select>
                        <button
                          onClick={() => handleRemoveCollaborator(collab.id, collab.id)}
                          className="p-1 rounded hover:bg-destructive/20 text-destructive"
                        >
                          <Trash2 size={14} />
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
        
        <div className="p-4 border-t bg-secondary/30">
          <p className="text-xs text-muted-foreground text-center">
            Приглашённые пользователи получат email с ссылкой для доступа к схеме
          </p>
        </div>
      </div>
    </div>
  )
}
