import React, { createContext, useContext, useState } from 'react';
import { translations } from '../locales/translations';

type Language = 'vi' | 'en';

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('connectlyLanguage');
    return (saved === 'en' || saved === 'vi') ? saved : 'vi';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('connectlyLanguage', lang);
  };

  // Helper function to resolve dot-notation string keys
  const t = (path: string): string => {
    const keys = path.split('.');
    let result: any = translations[language];

    for (const key of keys) {
      if (result && Object.prototype.hasOwnProperty.call(result, key)) {
        result = result[key];
      } else {
        // Fallback to English if translation is missing in Vietnamese
        let fallback: any = translations['en'];
        for (const fKey of keys) {
          if (fallback && Object.prototype.hasOwnProperty.call(fallback, fKey)) {
            fallback = fallback[fKey];
          } else {
            fallback = undefined;
            break;
          }
        }
        return fallback !== undefined ? fallback : path;
      }
    }

    return typeof result === 'string' ? result : path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextProps => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
