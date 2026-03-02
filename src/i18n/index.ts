import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import en from './locales/en.json'

// Read saved language preference or default to 'ru'
const savedLng = typeof window !== 'undefined'
  ? localStorage.getItem('app-language') || 'ru'
  : 'ru'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en }
    },
    lng: savedLng,
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
