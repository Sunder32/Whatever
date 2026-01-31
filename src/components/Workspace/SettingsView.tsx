import { useState } from 'react'
import { 
  Moon, 
  Sun, 
  Globe, 
  Bell, 
  Shield, 
  HardDrive,
  Cloud,
  User,
  Keyboard,
  Palette,
  Lock,
  Trash2,
  Download
} from 'lucide-react'
import { useTheme } from '@/hooks'
import { useAuthStore, useAppStore } from '@/stores'
import { cn } from '@/utils'

type SettingsTab = 'appearance' | 'account' | 'security' | 'storage' | 'notifications' | 'shortcuts'

export function SettingsView() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuthStore()
  const preferences = useAppStore(state => state.preferences)
  const updatePreferences = useAppStore(state => state.updatePreferences)
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  
  const tabs = [
    { id: 'appearance' as const, icon: Palette, label: 'Внешний вид' },
    { id: 'account' as const, icon: User, label: 'Аккаунт' },
    { id: 'security' as const, icon: Shield, label: 'Безопасность' },
    { id: 'storage' as const, icon: HardDrive, label: 'Хранилище' },
    { id: 'notifications' as const, icon: Bell, label: 'Уведомления' },
    { id: 'shortcuts' as const, icon: Keyboard, label: 'Горячие клавиши' },
  ]
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="col-span-1">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Content */}
        <div className="col-span-3 space-y-6">
          {activeTab === 'appearance' && (
            <>
              <div>
                <h2 className="text-lg font-semibold mb-4">Внешний вид</h2>
                
                <div className="space-y-6">
                  {/* Theme */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Тема</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors",
                          theme === 'dark' ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}
                      >
                        <Moon size={24} />
                        <span className="text-sm">Тёмная</span>
                      </button>
                      <button
                        onClick={() => setTheme('light')}
                        className={cn(
                          "p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors",
                          theme === 'light' ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}
                      >
                        <Sun size={24} />
                        <span className="text-sm">Светлая</span>
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={cn(
                          "p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors",
                          theme === 'system' ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}
                      >
                        <Globe size={24} />
                        <span className="text-sm">Системная</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Language */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Язык интерфейса</h3>
                    <select className="w-full max-w-xs px-3 py-2 rounded-lg bg-secondary border-0 focus:ring-2 focus:ring-primary outline-none">
                      <option value="ru">Русский</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  
                  {/* Font size */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Размер шрифта редактора</h3>
                    <input
                      type="range"
                      min="12"
                      max="24"
                      value={preferences.defaultFontSize || 14}
                      onChange={(e) => updatePreferences({ defaultFontSize: parseInt(e.target.value) })}
                      className="w-full max-w-xs"
                    />
                    <span className="text-sm text-muted-foreground ml-2">{preferences.defaultFontSize || 14}px</span>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'account' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Аккаунт</h2>
              
              <div className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                      {user?.fullName?.[0] || 'U'}
                    </div>
                    <div>
                      <p className="font-medium">{user?.fullName || 'Пользователь'}</p>
                      <p className="text-sm text-muted-foreground">@{user?.username}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 border rounded-lg text-sm hover:bg-secondary transition-colors">
                    Редактировать профиль
                  </button>
                </div>
                
                <div className="p-4 border border-destructive/50 rounded-lg">
                  <h3 className="text-sm font-medium text-destructive mb-2">Опасная зона</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Удаление аккаунта необратимо. Все ваши данные будут потеряны.
                  </p>
                  <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm hover:bg-destructive/90 flex items-center gap-2">
                    <Trash2 size={14} />
                    Удалить аккаунт
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'security' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Безопасность</h2>
              
              <div className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Lock size={16} />
                    Изменить пароль
                  </h3>
                  <div className="space-y-3 max-w-md">
                    <input
                      type="password"
                      placeholder="Текущий пароль"
                      className="w-full px-3 py-2 rounded-lg bg-secondary border-0 focus:ring-2 focus:ring-primary outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Новый пароль"
                      className="w-full px-3 py-2 rounded-lg bg-secondary border-0 focus:ring-2 focus:ring-primary outline-none"
                    />
                    <input
                      type="password"
                      placeholder="Подтвердите пароль"
                      className="w-full px-3 py-2 rounded-lg bg-secondary border-0 focus:ring-2 focus:ring-primary outline-none"
                    />
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">
                      Изменить пароль
                    </button>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium mb-3">Активные сессии</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe size={18} />
                        <div>
                          <p className="text-sm font-medium">Текущая сессия</p>
                          <p className="text-xs text-muted-foreground">Windows • Chrome</p>
                        </div>
                      </div>
                      <span className="text-xs text-green-500">Активна</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'storage' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Хранилище</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <HardDrive size={20} className="text-blue-500" />
                      <span className="font-medium">Локальное</span>
                    </div>
                    <p className="text-2xl font-bold">128 МБ</p>
                    <p className="text-sm text-muted-foreground">использовано</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Cloud size={20} className="text-green-500" />
                      <span className="font-medium">Облако</span>
                    </div>
                    <p className="text-2xl font-bold">1.2 ГБ</p>
                    <p className="text-sm text-muted-foreground">из 5 ГБ</p>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium mb-3">Экспорт данных</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Скачайте все ваши проекты и данные в формате ZIP
                  </p>
                  <button className="px-4 py-2 border rounded-lg text-sm hover:bg-secondary transition-colors flex items-center gap-2">
                    <Download size={14} />
                    Экспортировать все данные
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Уведомления</h2>
              
              <div className="space-y-4">
                {[
                  { id: 'email', label: 'Email уведомления', desc: 'Получать уведомления на почту' },
                  { id: 'projects', label: 'Приглашения в проекты', desc: 'Уведомлять о новых приглашениях' },
                  { id: 'updates', label: 'Обновления системы', desc: 'Информация о новых функциях' },
                  { id: 'marketing', label: 'Маркетинговые рассылки', desc: 'Новости и предложения' },
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <input type="checkbox" className="w-5 h-5 rounded" defaultChecked={item.id !== 'marketing'} />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'shortcuts' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Горячие клавиши</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Настройте горячие клавиши в настройках редактора
              </p>
              
              <div className="space-y-2">
                {[
                  { action: 'Новый файл', key: 'Ctrl+N' },
                  { action: 'Сохранить', key: 'Ctrl+S' },
                  { action: 'Открыть', key: 'Ctrl+O' },
                  { action: 'Отменить', key: 'Ctrl+Z' },
                  { action: 'Повторить', key: 'Ctrl+Y' },
                  { action: 'Копировать', key: 'Ctrl+C' },
                  { action: 'Вставить', key: 'Ctrl+V' },
                  { action: 'Выделить всё', key: 'Ctrl+A' },
                  { action: 'Панель команд', key: 'Ctrl+K' },
                ].map(shortcut => (
                  <div key={shortcut.action} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{shortcut.action}</span>
                    <kbd className="px-2 py-1 text-xs bg-secondary rounded font-mono">{shortcut.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
