import { useCallback, useRef, useState } from 'react';

import { latestWorkplaceDecisionInstant } from './workplace-home-decision-clock';

export type WorkplaceDecisionClockSnapshot = Readonly<{
  identityKey: string;
  nowInstant: number;
}>;

export function resolveWorkplaceDecisionClock(
  previous: WorkplaceDecisionClockSnapshot | null,
  identityKey: string,
  wallClock: number,
  sourceInstants: readonly (string | null | undefined)[] = []
): WorkplaceDecisionClockSnapshot {
  const candidate = latestWorkplaceDecisionInstant(wallClock, ...sourceInstants);
  return {
    identityKey,
    nowInstant:
      previous?.identityKey === identityKey ? Math.max(previous.nowInstant, candidate) : candidate,
  };
}

export function useWorkplaceDecisionClock(
  identityKey: string,
  sourceInstants: readonly (string | null | undefined)[] = []
) {
  const activeIdentityRef = useRef(identityKey);
  const sourceInstantsRef = useRef(sourceInstants);
  const snapshotRef = useRef<WorkplaceDecisionClockSnapshot | null>(null);
  const [wallClock, setWallClock] = useState(() => ({ identityKey, nowInstant: Date.now() }));

  activeIdentityRef.current = identityKey;
  sourceInstantsRef.current = sourceInstants;
  snapshotRef.current = resolveWorkplaceDecisionClock(
    snapshotRef.current,
    identityKey,
    wallClock.identityKey === identityKey ? wallClock.nowInstant : Date.now(),
    sourceInstants
  );

  const readNow = useCallback(() => {
    const activeIdentity = activeIdentityRef.current;
    snapshotRef.current = resolveWorkplaceDecisionClock(
      snapshotRef.current,
      activeIdentity,
      Date.now(),
      sourceInstantsRef.current
    );
    return snapshotRef.current.nowInstant;
  }, []);

  const advance = useCallback(() => {
    const activeIdentity = activeIdentityRef.current;
    const nowInstant = readNow();
    setWallClock({ identityKey: activeIdentity, nowInstant });
  }, [readNow]);

  return {
    advance,
    nowInstant: snapshotRef.current.nowInstant,
    readNow,
  };
}
