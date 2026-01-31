import { motion } from 'framer-motion'
import { 
  Download, 
  Github, 
  Zap, 
  Layers, 
  Cloud, 
  Palette,
  Monitor,
  FileJson,
  Lock,
  Sparkles,
  ArrowRight,
  Check,
  ExternalLink
} from 'lucide-react'

// Configuration
const DOWNLOAD_URL = 'https://github.com/Sunder32/Whatever/releases/download/v1.0.0/Diagram-App-1.0.0-Windows-Portable.zip'
const GITHUB_URL = 'https://github.com/Sunder32/Whatever'
const APP_VERSION = '1.0.0'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 }
}

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

function App() {
  return (
    <div className="min-h-screen animated-gradient bg-grid-pattern">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Diagram App</span>
          </div>
          
          <div className="flex items-center gap-4">
            <a href="#features" className="text-muted hover:text-white transition-colors">
              Возможности
            </a>
            <a href="#showcase" className="text-muted hover:text-white transition-colors">
              Примеры
            </a>
            <a 
              href={GITHUB_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {/* Badge */}
            <motion.div 
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted">Версия {APP_VERSION} — Бесплатно навсегда</span>
            </motion.div>
            
            {/* Main heading */}
            <motion.h1 
              variants={fadeInUp}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              Создавай диаграммы
              <br />
              <span className="gradient-text">легко и красиво</span>
            </motion.h1>
            
            {/* Subtitle */}
            <motion.p 
              variants={fadeInUp}
              className="text-xl text-muted max-w-2xl mx-auto mb-10"
            >
              Мощный десктопный редактор для создания схем, диаграмм и визуализаций. 
              Работает оффлайн. Экспортируй в PNG, SVG или PDF.
            </motion.p>
            
            {/* CTA Buttons */}
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <a href={DOWNLOAD_URL} className="btn-primary glow">
                <Download className="w-5 h-5" />
                Скачать для Windows
                <span className="text-sm opacity-70 ml-2">~80 MB</span>
              </a>
              
              <a href="#features" className="btn-secondary">
                Узнать больше
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
            
            {/* App Preview */}
            <motion.div
              variants={fadeInUp}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl glow">
                {/* Fake window header */}
                <div className="bg-surface flex items-center gap-2 px-4 py-3 border-b border-border/50">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="ml-4 text-sm text-muted">Diagram App — Новый проект.wtv</span>
                </div>
                
                {/* App screenshot placeholder */}
                <div className="bg-background aspect-video flex items-center justify-center">
                  <AppPreview />
                </div>
              </div>
              
              {/* Floating elements */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-8 -right-8 glass rounded-xl p-4 hidden lg:block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Сохранено</div>
                    <div className="text-xs text-muted">только что</div>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-4 -left-8 glass rounded-xl p-4 hidden lg:block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Быстрый экспорт</div>
                    <div className="text-xs text-muted">PNG, SVG, PDF</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-4">
              Все что нужно для
              <span className="gradient-text"> идеальных диаграмм</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-muted max-w-2xl mx-auto">
              Интуитивный интерфейс, мощные возможности, работа без интернета
            </motion.p>
          </motion.div>

          {/* Bento Grid */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* Feature 1 - Large */}
            <motion.div variants={fadeInUp} className="bento-card lg:col-span-2 lg:row-span-2">
              <div className="flex flex-col h-full">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-6">
                  <Monitor className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Нативное приложение</h3>
                <p className="text-muted mb-6">
                  Полноценное десктопное приложение, а не просто веб-сайт в обертке. 
                  Работает быстро, плавно и без задержек. Нативные диалоги сохранения и открытия файлов.
                </p>
                <div className="mt-auto rounded-xl bg-background/50 p-4 border border-border/30">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">60fps</div>
                      <div className="text-xs text-muted">Плавность</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-secondary">~80MB</div>
                      <div className="text-xs text-muted">Размер</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-accent">&lt;1s</div>
                      <div className="text-xs text-muted">Запуск</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div variants={fadeInUp} className="bento-card">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                <Cloud className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-2">Работает оффлайн</h3>
              <p className="text-muted text-sm">
                Все данные хранятся локально. Не нужен интернет для работы. Опциональная облачная синхронизация.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div variants={fadeInUp} className="bento-card">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                <FileJson className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Множество форматов</h3>
              <p className="text-muted text-sm">
                Экспорт в PNG, SVG, PDF, JSON. Собственный формат .wtv с полной историей изменений.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div variants={fadeInUp} className="bento-card">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-4">
                <Palette className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Красивый дизайн</h3>
              <p className="text-muted text-sm">
                Современный тёмный интерфейс. Готовые цветовые схемы. Широкая кастомизация элементов.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div variants={fadeInUp} className="bento-card">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Приватность</h3>
              <p className="text-muted text-sm">
                Ваши данные остаются на вашем компьютере. Шифрование файлов паролем. Без телеметрии.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div variants={fadeInUp} className="bento-card">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Слои и группы</h3>
              <p className="text-muted text-sm">
                Организуйте сложные диаграммы с помощью слоёв. Группируйте элементы. Контейнеры для вложенных схем.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Showcase Section */}
      <section id="showcase" className="py-32 relative bg-surface/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-4">
              Создавай <span className="gradient-text">что угодно</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-muted max-w-2xl mx-auto">
              Flowcharts, ER-диаграммы, mindmaps, архитектурные схемы и многое другое
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              { title: 'Flowchart', description: 'Блок-схемы алгоритмов' },
              { title: 'ER Diagram', description: 'Схемы баз данных' },
              { title: 'Architecture', description: 'Системная архитектура' },
              { title: 'Mind Map', description: 'Карты мышления' },
              { title: 'Org Chart', description: 'Оргструктуры' },
              { title: 'Network', description: 'Сетевые топологии' },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                variants={fadeInUp}
                className="group relative rounded-2xl overflow-hidden border border-border/50 bg-surface/50 aspect-[4/3]"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
                  <DiagramPreview type={index} />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-background to-transparent">
                  <h3 className="font-bold text-lg">{item.title}</h3>
                  <p className="text-sm text-muted">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px]" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-6xl font-bold mb-6">
              Готов создавать?
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-xl text-muted mb-10 max-w-xl mx-auto">
              Скачай Diagram App бесплатно и начни создавать профессиональные диаграммы прямо сейчас
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={DOWNLOAD_URL} className="btn-primary glow text-xl px-10 py-5">
                <Download className="w-6 h-6" />
                Скачать бесплатно
              </a>
              <a 
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer" 
                className="btn-secondary"
              >
                <Github className="w-5 h-5" />
                Исходный код
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Diagram App</span>
              <span className="text-muted text-sm">v{APP_VERSION}</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted">
              <a href="#" className="hover:text-white transition-colors">Документация</a>
              <a href="#" className="hover:text-white transition-colors">Changelog</a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                GitHub
              </a>
            </div>
            
            <div className="text-sm text-muted">
              © 2026 Diagram App. Open Source.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// App Preview Component (simplified diagram visualization)
function AppPreview() {
  return (
    <svg viewBox="0 0 800 450" className="w-full h-full">
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2a2a3a" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="800" height="450" fill="#0a0a0f"/>
      <rect width="800" height="450" fill="url(#grid)"/>
      
      {/* Sidebar */}
      <rect x="0" y="0" width="60" height="450" fill="#12121a"/>
      <rect x="15" y="80" width="30" height="30" rx="6" fill="#3b82f6" opacity="0.3"/>
      <rect x="15" y="120" width="30" height="30" rx="6" fill="#3b82f6" opacity="0.1"/>
      <rect x="15" y="160" width="30" height="30" rx="6" fill="#3b82f6" opacity="0.1"/>
      
      {/* Nodes */}
      <rect x="150" y="100" width="140" height="70" rx="12" fill="#3b82f6"/>
      <text x="220" y="140" textAnchor="middle" fill="white" fontSize="14" fontWeight="500">Начало</text>
      
      <rect x="500" y="100" width="140" height="70" rx="12" fill="#8b5cf6"/>
      <text x="570" y="140" textAnchor="middle" fill="white" fontSize="14" fontWeight="500">Процесс</text>
      
      <polygon points="400,250 460,300 400,350 340,300" fill="#f59e0b"/>
      <text x="400" y="305" textAnchor="middle" fill="white" fontSize="12" fontWeight="500">Условие?</text>
      
      <rect x="250" y="380" width="120" height="50" rx="8" fill="#10b981"/>
      <text x="310" y="410" textAnchor="middle" fill="white" fontSize="12">Да</text>
      
      <rect x="430" y="380" width="120" height="50" rx="8" fill="#ef4444"/>
      <text x="490" y="410" textAnchor="middle" fill="white" fontSize="12">Нет</text>
      
      {/* Connections */}
      <path d="M 290 135 L 500 135" stroke="#3b82f6" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)"/>
      <path d="M 570 170 L 570 220 L 400 220 L 400 250" stroke="#8b5cf6" strokeWidth="2" fill="none"/>
      <path d="M 340 300 L 310 300 L 310 380" stroke="#f59e0b" strokeWidth="2" fill="none"/>
      <path d="M 460 300 L 490 300 L 490 380" stroke="#f59e0b" strokeWidth="2" fill="none"/>
      
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6"/>
        </marker>
      </defs>
      
      {/* Selection handles */}
      <rect x="146" y="96" width="148" height="78" rx="14" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4"/>
      <circle cx="150" cy="100" r="5" fill="#3b82f6"/>
      <circle cx="294" cy="100" r="5" fill="#3b82f6"/>
      <circle cx="150" cy="170" r="5" fill="#3b82f6"/>
      <circle cx="294" cy="170" r="5" fill="#3b82f6"/>
      
      {/* Inspector panel */}
      <rect x="680" y="80" width="110" height="180" rx="8" fill="#12121a" stroke="#2a2a3a"/>
      <text x="695" y="105" fill="#6b7280" fontSize="10">СВОЙСТВА</text>
      <text x="695" y="130" fill="white" fontSize="11">Цвет:</text>
      <rect x="695" y="140" width="80" height="20" rx="4" fill="#3b82f6"/>
      <text x="695" y="180" fill="white" fontSize="11">Текст:</text>
      <rect x="695" y="190" width="80" height="20" rx="4" fill="#1a1a25" stroke="#2a2a3a"/>
      <text x="700" y="204" fill="#6b7280" fontSize="10">Начало</text>
    </svg>
  )
}

// Diagram type preview
function DiagramPreview({ type }: { type: number }) {
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
  const baseColor = colors[type % colors.length]
  
  return (
    <svg viewBox="0 0 200 150" className="w-3/4 h-3/4 opacity-60">
      <rect x="20" y="20" width="50" height="30" rx="6" fill={baseColor}/>
      <rect x="130" y="20" width="50" height="30" rx="6" fill={baseColor} opacity="0.7"/>
      <rect x="75" y="100" width="50" height="30" rx="6" fill={baseColor} opacity="0.5"/>
      <line x1="70" y1="35" x2="130" y2="35" stroke={baseColor} strokeWidth="2"/>
      <line x1="45" y1="50" x2="100" y2="100" stroke={baseColor} strokeWidth="2" opacity="0.7"/>
      <line x1="155" y1="50" x2="100" y2="100" stroke={baseColor} strokeWidth="2" opacity="0.7"/>
    </svg>
  )
}

export default App
