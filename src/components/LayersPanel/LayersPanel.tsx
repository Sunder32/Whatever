import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  GripVertical
} from 'lucide-react'
import { useDiagramStore } from '@/stores'
import { cn } from '@/utils'

interface LayersPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function LayersPanel({ isOpen, onClose: _onClose }: LayersPanelProps) {
  const { t } = useTranslation()
  const file = useDiagramStore(state => state.file)
  const addLayer = useDiagramStore(state => state.addLayer)
  const updateLayer = useDiagramStore(state => state.updateLayer)
  const deleteLayer = useDiagramStore(state => state.deleteLayer)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  
  if (!isOpen || !file) return null
  
  const layers = file.content.layers
  
  const handleAddLayer = () => {
    const name = `${t('layers.layer')} ${layers.length + 1}`
    addLayer(name)
  }
  
  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return // Keep at least one layer
    deleteLayer(id)
  }
  
  const handleToggleVisibility = (id: string, visible: boolean) => {
    updateLayer(id, { visible: !visible })
  }
  
  const handleToggleLock = (id: string, locked: boolean) => {
    updateLayer(id, { locked: !locked })
  }
  
  const handleRename = (id: string) => {
    const layer = layers.find(l => l.id === id)
    if (!layer) return
    
    const newName = prompt(t('layers.rename'), layer.name)
    if (newName && newName.trim()) {
      updateLayer(id, { name: newName.trim() })
    }
  }
  
  return (
    <div className="absolute right-0 top-0 w-64 h-full bg-popover border-l shadow-lg z-40 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Layers size={16} />
          {t('layers.title')}
        </h2>
        <button
          onClick={handleAddLayer}
          className="p-1 rounded hover:bg-accent"
          title={t('layers.addLayer')}
        >
          <Plus size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {layers.map((layer, _index) => (
          <div
            key={layer.id}
            className={cn(
              'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
              selectedLayerId === layer.id ? 'bg-accent' : 'hover:bg-accent/50'
            )}
            onClick={() => setSelectedLayerId(layer.id)}
            onDoubleClick={() => handleRename(layer.id)}
          >
            <GripVertical size={14} className="text-muted-foreground cursor-grab" />
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleToggleVisibility(layer.id, layer.visible)
              }}
              className="p-0.5 rounded hover:bg-background"
              title={layer.visible ? t('layers.hide') : t('layers.show')}
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-muted-foreground" />}
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleToggleLock(layer.id, layer.locked)
              }}
              className="p-0.5 rounded hover:bg-background"
              title={layer.locked ? t('layers.unlock') : t('layers.lock')}
            >
              {layer.locked ? <Lock size={14} className="text-amber-500" /> : <Unlock size={14} className="text-muted-foreground" />}
            </button>
            
            <span className="flex-1 text-sm truncate">{layer.name}</span>
            
            <span className="text-xs text-muted-foreground">
              {layer.elements.length}
            </span>
            
            {layers.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteLayer(layer.id)
                }}
                className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                title={t('layers.delete')}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      
      <div className="p-2 border-t text-xs text-muted-foreground">
        {t('layers.hint')}
      </div>
    </div>
  )
}
