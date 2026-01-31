# Landing Page - Инструкция

## Установка зависимостей

```bash
cd landing
npm install
```

## Запуск в режиме разработки

```bash
npm run dev
```

Откроется браузер на `http://localhost:5174`

## Обновление ссылки на скачивание

После того, как вы создадите релиз на GitHub и загрузите `.exe` файл:

1. Откройте файл `landing/src/App.tsx`
2. Найдите константу `DOWNLOAD_URL` в начале файла
3. Замените `#` на ссылку GitHub Release:
   ```typescript
   const DOWNLOAD_URL = "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/download/v1.0.0/Diagram-App-1.0.0-Portable.exe";
   ```

## Сборка для продакшн

```bash
npm run build
```

Статические файлы будут в папке `landing/dist/`

## Деплой на Vercel

### Быстрый деплой

1. Зарегистрируйтесь на [vercel.com](https://vercel.com)
2. Установите Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. В папке `landing/` запустите:
   ```bash
   vercel login
   vercel --prod
   ```

### Альтернативный деплой (через GitHub)

1. Загрузите проект на GitHub
2. Зайдите на [vercel.com](https://vercel.com)
3. Нажмите "Import Project"
4. Выберите ваш репозиторий
5. Укажите:
   - **Root Directory**: `landing`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Нажмите "Deploy"

## Другие варианты хостинга

### Netlify
```bash
# В папке landing/
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

### GitHub Pages
```bash
# Добавьте в landing/package.json:
{
  "scripts": {
    "deploy": "vite build && gh-pages -d dist"
  }
}

npm install -D gh-pages
npm run build
npm run deploy
```

### Cloudflare Pages
1. Зайдите на [pages.cloudflare.com](https://pages.cloudflare.com)
2. Подключите GitHub репозиторий
3. Настройки:
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `landing`

## Кастомизация

### Изменить цвета
Отредактируйте `landing/tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      primary: '#3b82f6', // синий
      // добавьте свои цвета
    }
  }
}
```

### Изменить контент
Все секции находятся в `landing/src/App.tsx`:
- **Hero** - главный баннер с заголовком
- **Features** - сетка возможностей (Bento Grid)
- **Showcase** - превью интерфейса
- **CTA** - призыв к действию

### Добавить иконки
В проекте используется [Lucide React](https://lucide.dev/):
```tsx
import { YourIcon } from 'lucide-react';
<YourIcon className="w-6 h-6" />
```

## Структура

```
landing/
├── src/
│   ├── App.tsx          # Главный компонент со всеми секциями
│   ├── main.tsx         # Точка входа React
│   └── index.css        # Глобальные стили
├── index.html           # HTML template
├── package.json         # Зависимости
├── vite.config.ts       # Конфигурация Vite
└── tailwind.config.js   # Конфигурация Tailwind CSS
```

## Технологии

- **React 18** - UI библиотека
- **Vite** - сборщик (быстрая разработка)
- **Tailwind CSS** - утилитарный CSS
- **Framer Motion** - анимации
- **Lucide React** - иконки

## Поддержка браузеров

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
