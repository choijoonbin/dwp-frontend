import { useMemo, useState, useEffect, useContext, useCallback, createContext } from 'react';

// ----------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark';

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

const STORAGE_KEY = 'dwp-theme-mode';
const COLOR_SCHEME_ATTR = 'data-color-scheme';

function setDomColorScheme(mode: ThemeMode) {
  document.documentElement.setAttribute(COLOR_SCHEME_ATTR, mode);
}

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';

  // 기존에 dark 모드가 저장되어 있어도 light로 리셋
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark') {
    window.localStorage.setItem(STORAGE_KEY, 'light');
    return 'light';
  }

  if (stored === 'light') return stored;

  return 'light';
}

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setDomColorScheme(next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : 'light');
  }, [mode, setMode]);

  useEffect(() => {
    setDomColorScheme(mode);
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}

