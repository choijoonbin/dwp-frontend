import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@dwp-frontend/shared-utils';
import type { ArchivePeriod, ArchiveSort } from './dwaion-archive-model';

type ArchiveView = {
  search: string;
  period: ArchivePeriod;
  sort: ArchiveSort;
  scrollY: number;
};
const INITIAL_VIEW: ArchiveView = {
  search: '',
  period: 'all',
  sort: 'recent',
  scrollY: 0,
};

function archiveScrollRoot() {
  const root = document.getElementById('dwp-main-content');
  return root && root.scrollHeight > root.clientHeight + 1 ? root : null;
}

function archiveScrollTop() {
  return archiveScrollRoot()?.scrollTop ?? window.scrollY;
}

function restoreArchiveScroll(top: number) {
  const root = archiveScrollRoot();
  if (root) root.scrollTo({ top, behavior: 'instant' });
  else window.scrollTo({ top, behavior: 'instant' });
}

/** Private view state lives only in the auth-cleared query cache, never URLs or browser storage. */
export function useDwaionArchiveView(ready: boolean) {
  const { user } = useAuth();
  const client = useQueryClient();
  const identity = `${user?.identityPlane ?? ''}:${user?.tenantId ?? ''}:${user?.userId ?? ''}:${user?.personPublicId ?? ''}`;
  const key = useMemo(() => ['dwaion', 'archive-view', identity], [identity]);
  const { data: view } = useQuery({
    queryKey: key,
    queryFn: async () => INITIAL_VIEW,
    initialData: INITIAL_VIEW,
    enabled: false,
    gcTime: Infinity,
    meta: { accessSensitive: true },
  });
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current) return undefined;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        restoreArchiveScroll(view.scrollY);
        restored.current = true;
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [ready, view.scrollY]);
  const updateView = (patch: Partial<ArchiveView>) => {
    client.setQueryData<ArchiveView>(key, (previous) => ({
      ...INITIAL_VIEW,
      ...previous,
      ...patch,
    }));
  };
  return {
    view,
    updateView,
    rememberScroll: () => updateView({ scrollY: archiveScrollTop() }),
  };
}
