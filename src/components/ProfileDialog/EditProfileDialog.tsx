import { useState, useRef } from 'react'
import { 
  X, 
  User, 
  Camera, 
  Save, 
  Loader2,
  MapPin,
  Link as LinkIcon,
  Mail
} from 'lucide-react'
import { useAuthStore } from '@/stores'

interface EditProfileDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function EditProfileDialog({ isOpen, onClose }: EditProfileDialogProps) {
  const { user, updateProfile } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null)
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    username: user?.username || '',
    bio: '',
    location: '',
    website: '',
    email: user?.email || ''
  })
  
  if (!isOpen) return null
  
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5 МБ')
      return
    }
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      await updateProfile({
        fullName: formData.fullName,
        avatarUrl: avatarPreview || undefined,
      })
      onClose()
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-popover border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Редактирование профиля</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <div 
                  onClick={handleAvatarClick}
                  className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center border-2 border-dashed border-primary/50 cursor-pointer overflow-hidden hover:border-primary transition-colors group"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} className="text-primary/50 group-hover:text-primary transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Фото профиля</p>
                <p className="text-sm text-muted-foreground mb-2">
                  JPG, PNG или GIF. Максимум 5 МБ.
                </p>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="text-sm text-primary hover:underline"
                >
                  Загрузить новое фото
                </button>
              </div>
            </div>
            
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Полное имя
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="Введите ваше имя"
              />
            </div>
            
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Имя пользователя
              </label>
              <div className="flex items-center">
                <span className="px-4 py-2.5 bg-muted border border-r-0 rounded-l-lg text-muted-foreground">
                  @
                </span>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  className="flex-1 px-4 py-2.5 rounded-r-lg bg-secondary border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="username"
                />
              </div>
            </div>
            
            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-2">
                О себе
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                rows={3}
                placeholder="Расскажите о себе..."
              />
            </div>
            
            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <MapPin size={14} className="inline mr-1" />
                Местоположение
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="Москва, Россия"
              />
            </div>
            
            {/* Website */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <LinkIcon size={14} className="inline mr-1" />
                Веб-сайт
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="https://example.com"
              />
            </div>
            
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <Mail size={14} className="inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2.5 rounded-lg bg-muted border text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email нельзя изменить
              </p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t bg-muted/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border hover:bg-secondary transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Сохранить
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
