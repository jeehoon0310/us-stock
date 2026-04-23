"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "ko" | "en";

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  mounted: boolean;
};

const LangContext = createContext<LangContextValue>({
  lang: "ko",
  setLang: () => {},
  toggle: () => {},
  mounted: false,
});

const STORAGE_KEY = "lang";
const LANG_VERSION = "2"; // 기본값이 ko→en으로 변경된 버전

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const version = window.localStorage.getItem("langVersion");
      if (version === LANG_VERSION) {
        // 이 버전 이후 명시적으로 저장한 값만 복원
        const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
        if (saved === "ko" || saved === "en") setLangState(saved);
      }
      // 버전 불일치(구버전 "ko" 저장) → 기본값 "en" 유지, 버전 갱신
      window.localStorage.setItem("langVersion", LANG_VERSION);
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.setAttribute("lang", lang);
    } catch {}
  }, [lang, mounted]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((p) => (p === "ko" ? "en" : "ko")), []);

  return (
    <LangContext.Provider value={{ lang, setLang, toggle, mounted }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
