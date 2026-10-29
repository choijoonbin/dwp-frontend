import { useEffect, useRef, useState } from 'react';

import { normalizeActivitySearchQuery, validActivitySearchQuery } from './activity-model';

export const ACTIVITY_SEARCH_DEBOUNCE_MS = 300;

export function useActivitySearchDraft(
  committedValue: string,
  onCommit: (value: string) => void,
  delayMs = ACTIVITY_SEARCH_DEBOUNCE_MS
) {
  const [draft, setDraft] = useState(committedValue);
  const onCommitRef = useRef(onCommit);
  const pendingInternalCommitRef = useRef<string | null>(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (pendingInternalCommitRef.current === committedValue) {
      pendingInternalCommitRef.current = null;
      return;
    }
    setDraft(committedValue);
  }, [committedValue]);

  useEffect(() => {
    const normalized = normalizeActivitySearchQuery(draft);
    if (!validActivitySearchQuery(normalized)) {
      if (committedValue) {
        pendingInternalCommitRef.current = '';
        onCommitRef.current('');
      }
      return;
    }
    if (normalized === committedValue) return;
    const timer = globalThis.setTimeout(() => {
      pendingInternalCommitRef.current = normalized;
      onCommitRef.current(normalized);
    }, delayMs);
    return () => globalThis.clearTimeout(timer);
  }, [committedValue, delayMs, draft]);

  return [draft, setDraft, !validActivitySearchQuery(draft)] as const;
}
