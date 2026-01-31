export type TemplateType = 'flowchart' | 'er-diagram' | 'network' | 'mindmap' | 'empty'

// Упрощённый тип узла для шаблонов
interface TemplateNode {
  id: string
  type: string
  position: { x: number; y: number }
  label: string
  description?: string
}

// Упрощённый тип связи для шаблонов  
interface TemplateEdge {
  id: string
  source: string
  target: string
  type?: string
  label?: string
}

interface DiagramTemplate {
  id: TemplateType
  name: string
  description: string
  nodes: TemplateNode[]
  edges: TemplateEdge[]
}

// Блок-схема (Flowchart)
const flowchartTemplate: DiagramTemplate = {
  id: 'flowchart',
  name: 'Блок-схема',
  description: 'Алгоритмы и процессы',
  nodes: [
    { id: 'start-1', type: 'ellipse', position: { x: 400, y: 50 }, label: 'Начало' },
    { id: 'process-1', type: 'rectangle', position: { x: 400, y: 150 }, label: 'Обработка данных' },
    { id: 'decision-1', type: 'diamond', position: { x: 400, y: 280 }, label: 'Условие?' },
    { id: 'process-2', type: 'rectangle', position: { x: 250, y: 400 }, label: 'Вариант А' },
    { id: 'process-3', type: 'rectangle', position: { x: 550, y: 400 }, label: 'Вариант Б' },
    { id: 'end-1', type: 'ellipse', position: { x: 400, y: 520 }, label: 'Конец' },
  ],
  edges: [
    { id: 'e1', source: 'start-1', target: 'process-1' },
    { id: 'e2', source: 'process-1', target: 'decision-1' },
    { id: 'e3', source: 'decision-1', target: 'process-2', label: 'Да' },
    { id: 'e4', source: 'decision-1', target: 'process-3', label: 'Нет' },
    { id: 'e5', source: 'process-2', target: 'end-1' },
    { id: 'e6', source: 'process-3', target: 'end-1' },
  ],
}

// ER-диаграмма (Entity-Relationship)
const erDiagramTemplate: DiagramTemplate = {
  id: 'er-diagram',
  name: 'ER-диаграмма',
  description: 'Схема базы данных',
  nodes: [
    { id: 'user-table', type: 'rectangle', position: { x: 100, y: 100 }, label: 'User' },
    { id: 'post-table', type: 'rectangle', position: { x: 450, y: 100 }, label: 'Post' },
    { id: 'comment-table', type: 'rectangle', position: { x: 450, y: 300 }, label: 'Comment' },
    { id: 'category-table', type: 'rectangle', position: { x: 100, y: 300 }, label: 'Category' },
  ],
  edges: [
    { id: 'rel-1', source: 'user-table', target: 'post-table', label: '1:N' },
    { id: 'rel-2', source: 'post-table', target: 'comment-table', label: '1:N' },
    { id: 'rel-3', source: 'user-table', target: 'comment-table', label: '1:N' },
    { id: 'rel-4', source: 'category-table', target: 'post-table', label: 'N:M' },
  ],
}

// Сетевая схема (Network Diagram)
const networkTemplate: DiagramTemplate = {
  id: 'network',
  name: 'Сетевая схема',
  description: 'Инфраструктура',
  nodes: [
    { id: 'internet', type: 'cloud', position: { x: 400, y: 30 }, label: 'Internet' },
    { id: 'firewall', type: 'rectangle', position: { x: 400, y: 130 }, label: 'Firewall' },
    { id: 'loadbalancer', type: 'rectangle', position: { x: 400, y: 230 }, label: 'Load Balancer' },
    { id: 'server-1', type: 'rectangle', position: { x: 200, y: 350 }, label: 'Web Server 1' },
    { id: 'server-2', type: 'rectangle', position: { x: 400, y: 350 }, label: 'Web Server 2' },
    { id: 'server-3', type: 'rectangle', position: { x: 600, y: 350 }, label: 'API Server' },
    { id: 'database', type: 'cylinder', position: { x: 300, y: 480 }, label: 'PostgreSQL' },
    { id: 'cache', type: 'cylinder', position: { x: 500, y: 480 }, label: 'Redis' },
  ],
  edges: [
    { id: 'n1', source: 'internet', target: 'firewall' },
    { id: 'n2', source: 'firewall', target: 'loadbalancer' },
    { id: 'n3', source: 'loadbalancer', target: 'server-1' },
    { id: 'n4', source: 'loadbalancer', target: 'server-2' },
    { id: 'n5', source: 'loadbalancer', target: 'server-3' },
    { id: 'n6', source: 'server-1', target: 'database' },
    { id: 'n7', source: 'server-2', target: 'database' },
    { id: 'n8', source: 'server-3', target: 'database' },
    { id: 'n9', source: 'server-3', target: 'cache' },
  ],
}

// Mind Map
const mindmapTemplate: DiagramTemplate = {
  id: 'mindmap',
  name: 'Mind Map',
  description: 'Идеи и концепции',
  nodes: [
    { id: 'central', type: 'ellipse', position: { x: 400, y: 300 }, label: 'Главная идея' },
    { id: 'branch-1', type: 'rectangle', position: { x: 200, y: 150 }, label: 'Идея 1' },
    { id: 'branch-2', type: 'rectangle', position: { x: 600, y: 150 }, label: 'Идея 2' },
    { id: 'branch-3', type: 'rectangle', position: { x: 200, y: 450 }, label: 'Идея 3' },
    { id: 'branch-4', type: 'rectangle', position: { x: 600, y: 450 }, label: 'Идея 4' },
    { id: 'sub-1-1', type: 'rectangle', position: { x: 50, y: 100 }, label: 'Подтема 1.1' },
    { id: 'sub-1-2', type: 'rectangle', position: { x: 50, y: 200 }, label: 'Подтема 1.2' },
    { id: 'sub-2-1', type: 'rectangle', position: { x: 750, y: 100 }, label: 'Подтема 2.1' },
    { id: 'sub-2-2', type: 'rectangle', position: { x: 750, y: 200 }, label: 'Подтема 2.2' },
  ],
  edges: [
    { id: 'm1', source: 'central', target: 'branch-1' },
    { id: 'm2', source: 'central', target: 'branch-2' },
    { id: 'm3', source: 'central', target: 'branch-3' },
    { id: 'm4', source: 'central', target: 'branch-4' },
    { id: 'm5', source: 'branch-1', target: 'sub-1-1' },
    { id: 'm6', source: 'branch-1', target: 'sub-1-2' },
    { id: 'm7', source: 'branch-2', target: 'sub-2-1' },
    { id: 'm8', source: 'branch-2', target: 'sub-2-2' },
  ],
}

// Empty template
const emptyTemplate: DiagramTemplate = {
  id: 'empty',
  name: 'Пустой проект',
  description: 'Начните с чистого листа',
  nodes: [],
  edges: [],
}

export const diagramTemplates: Record<TemplateType, DiagramTemplate> = {
  flowchart: flowchartTemplate,
  'er-diagram': erDiagramTemplate,
  network: networkTemplate,
  mindmap: mindmapTemplate,
  empty: emptyTemplate,
}

export function getTemplateById(id: TemplateType): DiagramTemplate {
  return diagramTemplates[id] || emptyTemplate
}

export function getAllTemplates(): DiagramTemplate[] {
  return Object.values(diagramTemplates)
}
