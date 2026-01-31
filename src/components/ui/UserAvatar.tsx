import { useState } from 'react'
import { User } from 'lucide-react'
import { cn } from '@/utils'

interface UserAvatarProps {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

// Generate a consistent color based on string hash
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  // Приглушённая профессиональная палитра
  const colors = [
    'bg-slate-600',
    'bg-zinc-600',
    'bg-neutral-600',
    'bg-stone-600',
    'bg-slate-700',
    'bg-zinc-700',
    'bg-gray-600',
    'bg-slate-500',
    'bg-zinc-500',
    'bg-neutral-500',
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl',
}

const iconSizes = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 40,
}

export function UserAvatar({ src, name, size = 'md', className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  
  const showImage = src && !imgError
  const colorClass = stringToColor(name || 'user')
  const initials = getInitials(name)
  
  return (
    <div 
      className={cn(
        'relative rounded-full flex items-center justify-center font-semibold text-white overflow-hidden shrink-0',
        sizeClasses[size],
        !showImage && colorClass,
        className
      )}
    >
      {showImage ? (
        <>
          {!imgLoaded && (
            <div className={cn('absolute inset-0 flex items-center justify-center', colorClass)}>
              {initials}
            </div>
          )}
          <img 
            src={src}
            alt={name}
            className={cn(
              'w-full h-full object-cover',
              !imgLoaded && 'opacity-0'
            )}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        </>
      ) : (
        initials || <User size={iconSizes[size]} />
      )}
    </div>
  )
}

export default UserAvatar
