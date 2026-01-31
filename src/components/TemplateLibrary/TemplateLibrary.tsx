import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Library, 
  Search, 
  Square, 
  Circle, 
  Triangle, 
  Diamond, 
  Database,
  Cloud as CloudIcon,
  Server,
  User,
  Folder
} from 'lucide-react'
import { useDiagramStore } from '@/stores'
import { cn } from '@/utils'

interface TemplateLibraryProps {
  isOpen: boolean
  onClose: () => void
}

interface TemplateItem {
  id: string
  name: string
  icon: React.ReactNode
  type: 'rectangle' | 'ellipse' | 'diamond' | 'triangle'
  defaultSize?: { width: number; height: number }
  defaultStyle?: {
    fill?: string
    stroke?: string
  }
}

interface TemplateCategory {
  id: string
  name: string
  items: TemplateItem[]
}

export function TemplateLibrary({ isOpen, onClose: _onClose }: TemplateLibraryProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('basic')
  const addNode = useDiagramStore(state => state.addNode)
  
  if (!isOpen) return null
  
  const categories: TemplateCategory[] = [
    {
      id: 'basic',
      name: t('library.basic'),
      items: [
        { id: 'rect', name: t('toolbar.rectangle'), icon: <Square size={20} />, type: 'rectangle' },
        { id: 'ellipse', name: t('toolbar.ellipse'), icon: <Circle size={20} />, type: 'ellipse' },
        { id: 'diamond', name: t('toolbar.diamond'), icon: <Diamond size={20} />, type: 'diamond' },
        { id: 'triangle', name: t('toolbar.triangle'), icon: <Triangle size={20} />, type: 'triangle' },
      ]
    },
    {
      id: 'flowchart',
      name: t('library.flowchart'),
      items: [
        { id: 'process', name: t('templates.process'), icon: <Square size={20} />, type: 'rectangle', defaultSize: { width: 140, height: 60 }, defaultStyle: { fill: '#e0f2fe', stroke: '#0284c7' } },
        { id: 'decision', name: t('templates.decision'), icon: <Diamond size={20} />, type: 'diamond', defaultSize: { width: 100, height: 100 }, defaultStyle: { fill: '#fef3c7', stroke: '#d97706' } },
        { id: 'terminal', name: t('templates.terminal'), icon: <Circle size={20} />, type: 'ellipse', defaultSize: { width: 120, height: 60 }, defaultStyle: { fill: '#dcfce7', stroke: '#16a34a' } },
        { id: 'data', name: t('templates.data'), icon: <Database size={20} />, type: 'rectangle', defaultSize: { width: 120, height: 80 }, defaultStyle: { fill: '#f3e8ff', stroke: '#9333ea' } },
      ]
    },
    {
      id: 'network',
      name: t('library.network'),
      items: [
        { id: 'server', name: t('templates.server'), icon: <Server size={20} />, type: 'rectangle', defaultSize: { width: 80, height: 100 }, defaultStyle: { fill: '#f1f5f9', stroke: '#475569' } },
        { id: 'cloud', name: t('templates.cloud'), icon: <CloudIcon size={20} />, type: 'ellipse', defaultSize: { width: 140, height: 80 }, defaultStyle: { fill: '#e0f2fe', stroke: '#0369a1' } },
        { id: 'database', name: t('templates.database'), icon: <Database size={20} />, type: 'ellipse', defaultSize: { width: 80, height: 100 }, defaultStyle: { fill: '#fef9c3', stroke: '#ca8a04' } },
        { id: 'user', name: t('templates.user'), icon: <User size={20} />, type: 'ellipse', defaultSize: { width: 60, height: 60 }, defaultStyle: { fill: '#dbeafe', stroke: '#2563eb' } },
      ]
    },
    {
      id: 'uml',
      name: t('library.uml'),
      items: [
        { id: 'class', name: t('templates.class'), icon: <Square size={20} />, type: 'rectangle', defaultSize: { width: 160, height: 120 }, defaultStyle: { fill: '#ffffff', stroke: '#374151' } },
        { id: 'interface', name: t('templates.interface'), icon: <Circle size={20} />, type: 'ellipse', defaultSize: { width: 100, height: 60 }, defaultStyle: { fill: '#f0fdf4', stroke: '#166534' } },
        { id: 'package', name: t('templates.package'), icon: <Folder size={20} />, type: 'rectangle', defaultSize: { width: 200, height: 150 }, defaultStyle: { fill: '#fffbeb', stroke: '#92400e' } },
        { id: 'actor', name: t('templates.actor'), icon: <User size={20} />, type: 'ellipse', defaultSize: { width: 40, height: 40 }, defaultStyle: { fill: '#fef2f2', stroke: '#dc2626' } },
      ]
    }
  ]
  
  const handleAddTemplate = (item: TemplateItem) => {
    addNode({
      type: item.type,
      text: item.name,
      size: item.defaultSize,
      style: item.defaultStyle ? { 
        fill: item.defaultStyle.fill ?? '#ffffff',
        stroke: item.defaultStyle.stroke ?? '#374151',
        strokeWidth: 2, 
        opacity: 1 
      } : undefined,
    })
  }
  
  const currentCategory = categories.find(c => c.id === selectedCategory)
  
  const filteredItems = searchQuery
    ? categories.flatMap(c => c.items).filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentCategory?.items ?? []
  
  return (
    <div className="absolute left-0 top-0 w-72 h-full bg-popover border-r shadow-lg z-40 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Library size={16} />
          {t('library.title')}
        </h2>
      </div>
      
      <div className="p-2 border-b">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('library.search')}
            className="w-full pl-7 pr-3 py-1.5 text-sm bg-secondary rounded border-0 outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      
      {!searchQuery && (
        <div className="flex border-b overflow-x-auto scrollbar-thin">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'px-3 py-2 text-xs whitespace-nowrap transition-colors',
                selectedCategory === category.id 
                  ? 'border-b-2 border-primary text-primary font-medium' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div className="grid grid-cols-2 gap-2">
          {filteredItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleAddTemplate(item)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ 
                  backgroundColor: item.defaultStyle?.fill ?? '#f3f4f6',
                  border: `2px solid ${item.defaultStyle?.stroke ?? '#9ca3af'}`
                }}
              >
                {item.icon}
              </div>
              <span className="text-xs text-center">{item.name}</span>
            </button>
          ))}
        </div>
        
        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {t('library.noResults')}
          </div>
        )}
      </div>
    </div>
  )
}
