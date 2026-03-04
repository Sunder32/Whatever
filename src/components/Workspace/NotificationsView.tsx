import { useState, useMemo, useEffect } from 'react'
import { 
  Bell, 
  Star, 
  GitFork, 
  Users, 
  MessageSquare,
  Check,
  X,
  Clock,
  Mail,
  Loader2
} from 'lucide-react'
import { useProjectStore } from '@/stores'
import { cn } from '@/utils'

interface Notification {
  id: string
  type: 'star' | 'fork' | 'follow' | 'comment' | 'invite'
  read: boolean
  user: {
    username: string
    fullName: string
    avatarUrl?: string
  }
  target?: string
  targetId?: string
  message?: string
  timestamp: string
  role?: 'read' | 'write' | 'admin'
}

export function NotificationsView() {
  const { 
    invitations, 
    fetchInvitations, 
    acceptInvitation, 
    declineInvitation 
  } = useProjectStore()
  
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set())
  
  // Fetch invitations on mount
  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])
  
  // Convert invitations to notifications format
  const notifications: Notification[] = useMemo(() => {
    const inviteNotifications: Notification[] = invitations
      .filter(inv => inv.status === 'pending')
      .map(inv => ({
        id: `invite-${inv.id}`,
        type: 'invite' as const,
        read: readNotifications.has(`invite-${inv.id}`),
        user: {
          username: inv.invitedBy.username,
          fullName: inv.invitedBy.fullName,
          avatarUrl: inv.invitedBy.avatarUrl,
        },
        target: inv.projectName,
        targetId: inv.id,
        timestamp: inv.createdAt,
        role: inv.role,
      }))
    
    return inviteNotifications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [invitations, readNotifications])
  
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 60) return `${diffMins} мин. назад`
    if (diffHours < 24) return `${diffHours} ч. назад`
    if (diffDays < 7) return `${diffDays} дн. назад`
    return date.toLocaleDateString('ru-RU')
  }
  
  const handleAcceptInvitation = async (notificationId: string, invitationId: string) => {
    setProcessingIds(prev => new Set(prev).add(notificationId))
    try {
      await acceptInvitation(invitationId)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(notificationId)
        return next
      })
    }
  }
  
  const handleDeclineInvitation = async (notificationId: string, invitationId: string) => {
    setProcessingIds(prev => new Set(prev).add(notificationId))
    try {
      await declineInvitation(invitationId)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(notificationId)
        return next
      })
    }
  }
  
  const markAllAsRead = () => {
    const allIds = new Set(notifications.map(n => n.id))
    setReadNotifications(allIds)
  }
  
  const markAsRead = (id: string) => {
    setReadNotifications(prev => new Set(prev).add(id))
  }
  
  const unreadCount = notifications.filter(n => !n.read).length
  
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Уведомления</h2>
          {unreadCount > 0 && (
            <p className="text-muted-foreground">{unreadCount} непрочитанных</p>
          )}
        </div>
        
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="px-4 py-2 text-sm text-primary hover:underline">
            Отметить все как прочитанные
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {notifications.map(notification => {
          const isProcessing = processingIds.has(notification.id)
          
          return (
            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={cn(
                "flex items-start gap-4 p-4 rounded-lg border transition-colors cursor-pointer",
                notification.read 
                  ? "bg-background hover:bg-secondary/30" 
                  : "bg-primary/5 border-primary/20 hover:bg-primary/10"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                notification.type === 'star' && "bg-yellow-500/20 text-yellow-500",
                notification.type === 'fork' && "bg-purple-500/20 text-purple-500",
                notification.type === 'follow' && "bg-blue-500/20 text-blue-500",
              notification.type === 'comment' && "bg-green-500/20 text-green-500",
              notification.type === 'invite' && "bg-orange-500/20 text-orange-500"
            )}>
              {notification.type === 'star' && <Star size={18} />}
              {notification.type === 'fork' && <GitFork size={18} />}
              {notification.type === 'follow' && <Users size={18} />}
              {notification.type === 'comment' && <MessageSquare size={18} />}
              {notification.type === 'invite' && <Mail size={18} />}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{notification.user.fullName}</span>
                {' '}
                <span className="text-muted-foreground">
                  {notification.type === 'star' && 'добавил(а) в избранное'}
                  {notification.type === 'fork' && 'форкнул(а)'}
                  {notification.type === 'follow' && 'подписался(ась) на вас'}
                  {notification.type === 'comment' && 'прокомментировал(а)'}
                  {notification.type === 'invite' && `пригласил(а) вас как ${notification.role === 'write' ? 'редактора' : notification.role === 'admin' ? 'администратора' : 'наблюдателя'} в проект`}
                </span>
                {notification.target && (
                  <>
                    {' '}
                    <span className="text-primary font-medium">{notification.target}</span>
                  </>
                )}
              </p>
              
              {notification.message && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  "{notification.message}"
                </p>
              )}
              
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Clock size={12} />
                {formatTime(notification.timestamp)}
              </p>
              
              {/* Actions for invites */}
              {notification.type === 'invite' && notification.targetId && (
                <div className="flex items-center gap-2 mt-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAcceptInvitation(notification.id, notification.targetId!)
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Принять
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeclineInvitation(notification.id, notification.targetId!)
                    }}
                    disabled={isProcessing}
                    className="px-3 py-1.5 border rounded text-sm hover:bg-secondary flex items-center gap-1 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <X size={14} />
                    )}
                    Отклонить
                  </button>
                </div>
              )}
            </div>
            
            {/* Unread indicator */}
            {!notification.read && (
              <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
            )}
          </div>
          )
        })}
        
        {notifications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Нет уведомлений</p>
            <p className="text-sm">Здесь будут появляться приглашения в проекты и другие уведомления</p>
          </div>
        )}
      </div>
    </div>
  )
}
