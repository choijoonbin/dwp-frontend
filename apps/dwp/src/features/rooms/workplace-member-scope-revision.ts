import { useRef } from 'react';

/** A scope revisited later never accepts an earlier command's completion. */
export function useWorkplaceMemberScopeRevision(key: string) {
  const issued = useRef({ key, revision: 0 });
  if (issued.current.key !== key) issued.current = { key, revision: issued.current.revision + 1 };
  return `${key}:${issued.current.revision}`;
}
