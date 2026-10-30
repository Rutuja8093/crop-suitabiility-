"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import en from "./locales/en.json";
import mr from "./locales/mr.json";

export type Language = "en" | "mr";

type TranslationKeys = typeof en;

interface I18nContextType {
  language: Language;
  locale: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  isMarathi: boolean;
}

const translations: Record<Language, any> = {
  en,
  mr,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");

  // Load language preference from localStorage if in client
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("soilpilot_lang") as Language;
      if (savedLang === "en" || savedLang === "mr") {
        setLanguageState(savedLang);
      }
    } catch {
      // Ignore localStorage read errors in SSR/strict environments
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("soilpilot_lang", lang);
    } catch {
      // Ignore localStorage write errors
    }
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split(".");
    let current: any = translations[language];

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        // Fallback to English if translation key missing in current language
        let fallback: any = translations.en;
        for (const fbKey of keys) {
          if (fallback && typeof fallback === "object" && fbKey in fallback) {
            fallback = fallback[fbKey];
          } else {
            return path;
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== "string") {
      return path;
    }

    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
      }, current);
    }

    return current;
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        locale: language,
        setLanguage,
        t,
        isMarathi: language === "mr",
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
