import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Circle, MousePointer2 } from 'lucide-react'
import { webSocketService } from '@/services'

interface PresenceUser {
  userId: string
  userName: string
  color: string
  position?: { x: number; y: number }
  lastUpdate: number
}

interface PresenceSidebarProps {
  isOpen: boolean
  onClose: () => void
  currentUserId: string
}

export function PresenceSidebar({ isOpen, onClose: _onClose, currentUserId }: PresenceSidebarProps) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map())

  useEffect(() => {
    if (!isOpen) return

    const unsubJoin = webSocketService.on('user_joined', (data: unknown) => {
      const { userId, userName, color } = data as { userId: string; userName: string; color?: string }
      setUsers(prev => {
        const updated = new Map(prev)
        updated.set(userId, {
          userId,
          userName,
          color: color || generateColor(userId),
          lastUpdate: Date.now(),
        })
        return updated
      })
    })

    const unsubLeave = webSocketService.on('user_left', (data: unknown) => {
      const { userId } = data as { userId: string }
      setUsers(prev => {
        const updated = new Map(prev)
        updated.delete(userId)
        return updated
      })
    })

    const unsubCursor = webSocketService.on('cursor_move', (data: unknown) => {
      const { userId, userName, color, position } = data as PresenceUser
      if (userId === currentUserId) return
      setUsers(prev => {
        const updated = new Map(prev)
        updated.set(userId, {
          userId,
          userName,
          color: color || generateColor(userId),
          position,
          lastUpdate: Date.now(),
        })
        return updated
      })
    })

    // Clean up stale users every 10s
    const interval = setInterval(() => {
      setUsers(prev => {
        const now = Date.now()
        const updated = new Map(prev)
        updated.forEach((user, id) => {
          if (now - user.lastUpdate > 30000) updated.delete(id)
        })
        return updated
      })
    }, 10000)

    return () => {
      unsubJoin()
      unsubLeave()
      unsubCursor()
      clearInterval(interval)
    }
  }, [isOpen, currentUserId])

  if (!isOpen) return null

  const userList = Array.from(users.values()).filter(u => u.userId !== currentUserId)

  return (
    <div className="absolute right-0 top-0 w-56 h-full bg-popover border-l shadow-lg z-40 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Users size={16} />
          {t('presence.title', 'Online Users')}
        </h2>
        <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
          {userList.length + 1}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Current user */}
        <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: '#3b82f6' }}
          >
            {t('presence.you', 'You').charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{t('presence.you', 'You')}</p>
            <p className="text-[10px] text-muted-foreground">{t('presence.editing', 'Editing')}</p>
          </div>
          <Circle size={8} className="text-green-500 fill-green-500" />
        </div>

        {/* Other users */}
        {userList.map(user => (
          <div key={user.userId} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{user.userName}</p>
              {user.position && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MousePointer2 size={10} />
                  {Math.round(user.position.x)}, {Math.round(user.position.y)}
                </p>
              )}
            </div>
            <Circle size={8} className="text-green-500 fill-green-500" />
          </div>
        ))}

        {userList.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Users size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">{t('presence.noOthers', 'No other users online')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function generateColor(userId: string): string {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899']
  let hash = 0
  for (const char of userId) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
