"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Lang } from "./i18n";

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageCtx>({
  lang: "en",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = localStorage.getItem("pt-lang");
    if (stored === "ja") setLangState("ja");
  }, []);

  const setLang = (l: Lang) => {
    localStorage.setItem("pt-lang", l);
    setLangState(l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageCtx {
  return useContext(LanguageContext);
}
