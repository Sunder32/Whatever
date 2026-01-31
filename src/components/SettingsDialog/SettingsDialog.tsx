import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Sun, Moon, Monitor, Grid, Save, Keyboard, Type, Palette, RotateCcw, User, Camera } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAppStore, useAuthStore } from '@/stores'
import { defaultShortcuts, formatShortcut, type ShortcutAction } from '@/hooks'
import { cn } from '@/utils'
import type { ShortcutConfig } from '@/stores/appStore'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

type Tab = 'appearance' | 'profile' | 'canvas' | 'editor' | 'shortcuts' | 'sync'

// Shortcut editor component
function ShortcutEditor({ 
  defaultShortcut,
  customShortcut,
  onSave 
}: { 
  defaultShortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; description: string }
  customShortcut?: ShortcutConfig
  onSave: (shortcut: ShortcutConfig | null) => void 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [recording, setRecording] = useState(false)
  const inputRef = useRef<HTMLButtonElement>(null)
  
  const currentShortcut = customShortcut || defaultShortcut
  const isCustomized = !!customShortcut
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return
    e.preventDefault()
    
    // Ignore modifier-only presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
    
    const newShortcut: ShortcutConfig = {
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    }
    
    onSave(newShortcut)
    setRecording(false)
    setIsEditing(false)
  }
  
  const handleReset = () => {
    onSave(null)
    setIsEditing(false)
  }
  
  const displayShortcut = formatShortcut(currentShortcut)
  
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm">{defaultShortcut.description}</span>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <button
              ref={inputRef}
              onKeyDown={handleKeyDown}
              onBlur={() => { setRecording(false); setIsEditing(false) }}
              onClick={() => setRecording(true)}
              autoFocus
              className={cn(
                "px-3 py-1 text-xs rounded font-mono border-2 outline-none min-w-[100px] text-center",
                recording 
                  ? "border-primary bg-primary/10 animate-pulse" 
                  : "border-muted bg-muted"
              )}
            >
              {recording ? 'Нажмите клавиши...' : displayShortcut}
            </button>
            {isCustomized && (
              <button
                onClick={handleReset}
                className="p-1 rounded hover:bg-accent"
                title="Сбросить"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className={cn(
              "px-2 py-1 text-xs rounded font-mono cursor-pointer hover:bg-accent/50 transition-colors",
              isCustomized ? "bg-primary/20 text-primary" : "bg-muted"
            )}
          >
            {displayShortcut}
          </button>
        )}
      </div>
    </div>
  )
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { user } = useAuthStore()
  const preferences = useAppStore(state => state.preferences)
  const updatePreferences = useAppStore(state => state.updatePreferences)
  const customShortcuts = useAppStore(state => state.customShortcuts)
  const setCustomShortcut = useAppStore(state => state.setCustomShortcut)
  const resetShortcuts = useAppStore(state => state.resetShortcuts)
  const [activeTab, setActiveTab] = useState<Tab>('appearance')
  
  // Profile editing state
  const [profileName, setProfileName] = useState(user?.fullName || '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Handle avatar file selection
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setProfileMessage({ type: 'error', text: 'Файл слишком большой (макс. 5MB)' })
        return
      }
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setProfileMessage({ type: 'error', text: 'Допустимы только изображения' })
        return
      }
      setAvatarFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAvatarPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
      setProfileMessage(null)
    }
  }
  
  // Handle profile save
  const handleProfileSave = async () => {
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      const { authApi } = await import('@/api')
      const response = await authApi.updateProfile({
        fullName: profileName || undefined,
        avatarFile: avatarFile || undefined,
      })
      if (response.success) {
        setProfileMessage({ type: 'success', text: 'Профиль обновлён!' })
        setAvatarFile(null)
        // Refresh profile in store
        await useAuthStore.getState().refreshProfile()
      } else {
        setProfileMessage({ type: 'error', text: response.error || 'Ошибка сохранения' })
      }
    } catch (err) {
      setProfileMessage({ type: 'error', text: 'Ошибка сети' })
    } finally {
      setProfileSaving(false)
    }
  }
  
  if (!isOpen) return null
  
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: t('settings.appearance'), icon: <Palette size={16} /> },
    { id: 'profile', label: 'Профиль', icon: <User size={16} /> },
    { id: 'canvas', label: t('settings.canvas'), icon: <Grid size={16} /> },
    { id: 'editor', label: 'Редактор', icon: <Type size={16} /> },
    { id: 'shortcuts', label: t('settings.shortcuts'), icon: <Keyboard size={16} /> },
    { id: 'sync', label: t('settings.sync'), icon: <Save size={16} /> },
  ]
  
  // Group shortcuts by category
  const shortcutCategories: Array<{ name: string; actions: ShortcutAction[] }> = [
    {
      name: 'Инструменты',
      actions: ['toolSelect', 'toolPan', 'toolRectangle', 'toolEllipse', 'toolDiamond', 
                'toolTriangle', 'toolLine', 'toolArrow', 'toolText', 'toolImage', 'toolFreehand']
    },
    {
      name: 'Редактирование',
      actions: ['undo', 'redo', 'cut', 'copy', 'paste', 'duplicate', 'delete', 'selectAll', 'deselect']
    },
    {
      name: 'Вид',
      actions: ['zoomIn', 'zoomOut', 'zoomReset', 'toggleGrid']
    },
    {
      name: 'Файл',
      actions: ['newFile', 'save', 'open', 'commandPalette', 'settings']
    },
  ]
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex h-[400px]">
          {/* Sidebar */}
          <div className="w-48 border-r bg-muted/30 p-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors',
                  activeTab === tab.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">{t('settings.theme')}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors',
                        theme === 'light' ? 'border-primary bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <Sun size={24} />
                      <span className="text-xs">{t('settings.themeLight')}</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors',
                        theme === 'dark' ? 'border-primary bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <Moon size={24} />
                      <span className="text-xs">{t('settings.themeDark')}</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors',
                        theme === 'system' ? 'border-primary bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <Monitor size={24} />
                      <span className="text-xs">{t('settings.themeSystem')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Avatar */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Аватар</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden border-2 border-border">
                        {avatarPreview || user?.avatarUrl ? (
                          <img 
                            src={avatarPreview || user?.avatarUrl || ''} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-2xl font-bold">
                            {user?.fullName?.[0] || user?.username?.[0] || 'U'}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                      >
                        <Camera size={14} />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        Нажмите на иконку камеры чтобы загрузить новый аватар.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Поддерживаются JPG, PNG, GIF до 5MB
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Full Name */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Имя</h3>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-full px-3 py-2 text-sm bg-secondary rounded border-0 outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                {/* Email (read-only) */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Email</h3>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-secondary/50 rounded border-0 outline-none text-muted-foreground cursor-not-allowed"
                  />
                </div>
                
                {/* Save button */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleProfileSave}
                    disabled={profileSaving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {profileSaving ? 'Сохранение...' : 'Сохранить изменения'}
                  </button>
                  {profileMessage && (
                    <span className={cn(
                      "text-sm",
                      profileMessage.type === 'success' ? 'text-green-500' : 'text-red-500'
                    )}>
                      {profileMessage.text}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'canvas' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">{t('settings.gridSize')}</h3>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={preferences.gridSize}
                      onChange={(e) => updatePreferences({ gridSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm w-12 text-center">{preferences.gridSize}px</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{t('settings.snapToGrid')}</span>
                    <p className="text-xs text-muted-foreground">Привязывать элементы к сетке</p>
                  </div>
                  <button
                    onClick={() => updatePreferences({ snapToGrid: !preferences.snapToGrid })}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      preferences.snapToGrid ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        preferences.snapToGrid && 'translate-x-5'
                      )}
                    />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{t('settings.showMiniMap')}</span>
                    <p className="text-xs text-muted-foreground">Показывать миникарту в углу</p>
                  </div>
                  <button
                    onClick={() => updatePreferences({ showMiniMap: !preferences.showMiniMap })}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      preferences.showMiniMap ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        preferences.showMiniMap && 'translate-x-5'
                      )}
                    />
                  </button>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Масштаб по умолчанию</h3>
                  <select
                    defaultValue="1"
                    className="w-full px-3 py-2 text-sm bg-secondary rounded border-0 outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="0.5">50%</option>
                    <option value="0.75">75%</option>
                    <option value="1">100%</option>
                    <option value="1.5">150%</option>
                    <option value="2">200%</option>
                  </select>
                </div>
              </div>
            )}
            
            {activeTab === 'editor' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">Шрифт по умолчанию</h3>
                  <select
                    value={preferences.defaultFontFamily}
                    onChange={(e) => updatePreferences({ defaultFontFamily: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-secondary rounded border-0 outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Roboto">Roboto</option>
                  </select>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Размер шрифта по умолчанию</h3>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="8"
                      max="48"
                      step="2"
                      value={preferences.defaultFontSize}
                      onChange={(e) => updatePreferences({ defaultFontSize: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm w-12 text-center">{preferences.defaultFontSize}px</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Цвет заливки по умолчанию</h3>
                  <div className="flex gap-2 flex-wrap">
                    {['#ffffff', '#f3f4f6', '#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#e9d5ff', '#e5e7eb'].map(color => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded border-2 border-transparent hover:border-primary transition-colors"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Цвет обводки по умолчанию</h3>
                  <div className="flex gap-2 flex-wrap">
                    {['#1f2937', '#374151', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'].map(color => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded border-2 border-transparent hover:border-primary transition-colors"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Нажмите на комбинацию, чтобы изменить её
                  </p>
                  <button
                    onClick={() => resetShortcuts()}
                    className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded transition-colors"
                  >
                    Сбросить все
                  </button>
                </div>
                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                  {shortcutCategories.map((category) => (
                    <div key={category.name}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                        {category.name}
                      </h3>
                      <div className="space-y-1">
                        {category.actions.map((actionKey) => (
                          <ShortcutEditor
                            key={actionKey}
                            defaultShortcut={defaultShortcuts[actionKey]}
                            customShortcut={customShortcuts[actionKey]}
                            onSave={(shortcut) => setCustomShortcut(actionKey, shortcut)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'sync' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">{t('settings.autoSaveInterval')}</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={preferences.autoSaveInterval}
                      onChange={(e) => updatePreferences({ autoSaveInterval: parseInt(e.target.value) })}
                      className="flex-1 px-3 py-2 text-sm bg-secondary rounded border-0 outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">{t('settings.seconds')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
