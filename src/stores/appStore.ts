import { create } from 'zustand'
import type { Tool, UserPreferences, AppState } from '@/types'

interface PanelVisibility {
  fileExplorer: boolean
  inspector: boolean
  toolbar: boolean
  statusBar: boolean
  layersPanel: boolean
}

// Custom shortcut configuration
export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

// Map of action names to custom shortcuts
export type CustomShortcuts = Partial<Record<string, ShortcutConfig>>

interface AppStore extends AppState {
  preferences: UserPreferences
  panelVisibility: PanelVisibility
  customShortcuts: CustomShortcuts
  
  setCurrentTool: (tool: Tool) => void
  setOnlineStatus: (isOnline: boolean) => void
  setSyncing: (isSyncing: boolean) => void
  setSyncingStatus: (isSyncing: boolean) => void
  setLastSaved: (timestamp: string) => void
  setHasUnsavedChanges: (hasChanges: boolean) => void
  updatePreferences: (prefs: Partial<UserPreferences>) => void
  togglePanel: (panel: keyof PanelVisibility) => void
  setPanelVisibility: (panel: keyof PanelVisibility, visible: boolean) => void
  setCustomShortcut: (action: string, shortcut: ShortcutConfig | null) => void
  resetShortcuts: () => void
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  autoSaveInterval: 30,
  gridSize: 20,
  snapToGrid: true,
  showMiniMap: true,
  defaultFontFamily: 'Inter',
  defaultFontSize: 14,
}

const defaultPanelVisibility: PanelVisibility = {
  fileExplorer: true,
  inspector: true,
  toolbar: true,
  statusBar: true,
  layersPanel: false,
}

export const useAppStore = create<AppStore>()(
  (set) => ({
    currentTool: 'select',
    isOnline: true,
    isSyncing: false,
    lastSaved: undefined,
    hasUnsavedChanges: false,
    preferences: defaultPreferences,
    panelVisibility: defaultPanelVisibility,
    customShortcuts: {},

    setCurrentTool: (tool: Tool) => set({ currentTool: tool }),
    
    setOnlineStatus: (isOnline: boolean) => set({ isOnline }),
    
    setSyncing: (isSyncing: boolean) => set({ isSyncing }),
    
    setSyncingStatus: (isSyncing: boolean) => set({ isSyncing }),
    
    setLastSaved: (timestamp: string) => set({ lastSaved: timestamp, hasUnsavedChanges: false }),
    
    setHasUnsavedChanges: (hasChanges: boolean) => set({ hasUnsavedChanges: hasChanges }),
    
    updatePreferences: (prefs: Partial<UserPreferences>) => 
      set(state => ({ preferences: { ...state.preferences, ...prefs } })),
    
    togglePanel: (panel: keyof PanelVisibility) =>
      set(state => ({
        panelVisibility: {
          ...state.panelVisibility,
          [panel]: !state.panelVisibility[panel]
        }
      })),
    
    setPanelVisibility: (panel: keyof PanelVisibility, visible: boolean) =>
      set(state => ({
        panelVisibility: {
          ...state.panelVisibility,
          [panel]: visible
        }
      })),
    
    setCustomShortcut: (action: string, shortcut: ShortcutConfig | null) =>
      set(state => {
        const newShortcuts = { ...state.customShortcuts }
        if (shortcut === null) {
          delete newShortcuts[action]
        } else {
          newShortcuts[action] = shortcut
        }
        return { customShortcuts: newShortcuts }
      }),
    
    resetShortcuts: () => set({ customShortcuts: {} }),
  })
)
