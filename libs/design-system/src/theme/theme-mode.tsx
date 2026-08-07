import {
  useMemo,
  useState,
  useContext,
  useCallback,
  createContext,
  useLayoutEffect,
} from 'react';

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
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(COLOR_SCHEME_ATTR, mode);
}

/** 기본값: light 모드 (프로젝트 정책) */
const DEFAULT_MODE: ThemeMode = 'light';

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  if (storedMode === 'light' || storedMode === 'dark') return storedMode;
  return DEFAULT_MODE;
}

/** 첫 페인트 전에 data-color-scheme 적용 — 헤더/사이드바 등 테마 불일치 방지 */
function initDomColorScheme() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const initial = getInitialMode();
  document.documentElement.setAttribute(COLOR_SCHEME_ATTR, initial);
}
initDomColorScheme();

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

  useLayoutEffect(() => {
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
