import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMeetingBackgroundProcessor,
  type MeetingBackgroundProcessor,
  type MeetingBackgroundState,
} from './meeting-background-processor';
import type { MeetingBackgroundMode } from './meeting-background-types';

/** Install at capture time, never after an unprocessed track has been published. */
export function useMeetingBackgroundPublication(
  mode: MeetingBackgroundMode,
  authorizationScope: string,
  hdVideo = false
) {
  const [snapshot, setSnapshot] = useState<{
    owner: MeetingBackgroundProcessor;
    state: MeetingBackgroundState;
  } | null>(null);
  const fence = useRef<{
    generation: number;
    scope: string;
    processor?: MeetingBackgroundProcessor;
    alive: boolean;
  }>({ generation: 0, scope: authorizationScope, alive: true });
  const processor = useMemo(() => {
    if (mode === 'original') return undefined;
    const next = createMeetingBackgroundProcessor({
      mode,
      hdVideo,
      stopInputOnFailure: true,
      onStateChange: (state) => {
        if (
          fence.current.alive &&
          fence.current.scope === authorizationScope &&
          fence.current.processor === next
        )
          setSnapshot({ owner: next, state });
      },
    });
    return next;
  }, [mode, authorizationScope, hdVideo]);
  fence.current.processor = processor;
  fence.current.scope = authorizationScope;
  useEffect(() => {
    const owner = fence.current;
    owner.alive = true;
    const current = ++owner.generation;
    return () => {
      if (owner.processor === processor) owner.alive = false;
      // React StrictMode replays setup synchronously. Do not destroy its reused capture owner.
      queueMicrotask(() => {
        if (owner.processor !== processor || owner.generation === current)
          void processor?.destroy();
      });
    };
  }, [processor]);
  return {
    processor,
    state: snapshot?.owner === processor ? snapshot?.state : undefined,
  };
}
