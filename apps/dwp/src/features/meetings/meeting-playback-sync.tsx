import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type PlaybackAccessRequest = (startMillis: number | null) => void;

type MeetingPlaybackSync = {
  registerMedia: (element: HTMLMediaElement | null) => void;
  registerAccessRequest: (request: PlaybackAccessRequest | null) => void;
  seekTo: (startMillis: number) => void;
  currentMillis: number | null;
};

const MeetingPlaybackSyncContext = createContext<MeetingPlaybackSync | null>(null);

export function MeetingPlaybackSyncProvider({ children }: { children: ReactNode }) {
  const media = useRef<HTMLMediaElement | null>(null);
  const accessRequest = useRef<PlaybackAccessRequest | null>(null);
  const pendingStart = useRef<number | null>(null);
  const [currentMillis, setCurrentMillis] = useState<number | null>(null);
  const detachTimeListener = useRef<(() => void) | null>(null);

  const applyPendingStart = useCallback(() => {
    const element = media.current;
    const startMillis = pendingStart.current;
    if (!element || startMillis == null || element.readyState < 1) {
      return;
    }
    element.currentTime = Math.max(0, startMillis / 1_000);
    pendingStart.current = null;
    const reduceMotion =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    element.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    element.focus({ preventScroll: true });
  }, []);

  const registerMedia = useCallback(
    (element: HTMLMediaElement | null) => {
      detachTimeListener.current?.();
      detachTimeListener.current = null;
      media.current = element;
      if (!element) {
        setCurrentMillis(null);
        return;
      }
      const updateTime = () =>
        setCurrentMillis(Math.max(0, Math.round(element.currentTime * 1_000)));
      element.addEventListener('timeupdate', updateTime);
      element.addEventListener('seeked', updateTime);
      element.addEventListener('loadedmetadata', updateTime);
      detachTimeListener.current = () => {
        element.removeEventListener('timeupdate', updateTime);
        element.removeEventListener('seeked', updateTime);
        element.removeEventListener('loadedmetadata', updateTime);
      };
      updateTime();
      applyPendingStart();
    },
    [applyPendingStart]
  );

  useEffect(() => () => detachTimeListener.current?.(), []);

  const registerAccessRequest = useCallback((request: PlaybackAccessRequest | null) => {
    accessRequest.current = request;
  }, []);

  const seekTo = useCallback(
    (startMillis: number) => {
      if (!Number.isSafeInteger(startMillis) || startMillis < 0) return;
      pendingStart.current = startMillis;
      if (media.current) applyPendingStart();
      else accessRequest.current?.(startMillis);
    },
    [applyPendingStart]
  );

  const value = useMemo<MeetingPlaybackSync>(
    () => ({
      registerMedia,
      registerAccessRequest,
      seekTo,
      currentMillis,
    }),
    [currentMillis, registerAccessRequest, registerMedia, seekTo]
  );

  return (
    <MeetingPlaybackSyncContext.Provider value={value}>
      {children}
    </MeetingPlaybackSyncContext.Provider>
  );
}

export function useMeetingPlaybackSync() {
  return useContext(MeetingPlaybackSyncContext);
}
