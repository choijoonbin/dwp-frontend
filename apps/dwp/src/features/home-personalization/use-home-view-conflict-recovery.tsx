import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { HttpError, useToast } from '@dwp-frontend/shared-utils';

import { HomePreferenceConflictDialog } from '../../components/home-preference-conflict-dialog';
import { parseHomeViewConflict, type HomeViewConflict } from './home-view-conflict';

import type { HomeDeviceLayout, HomeView } from '@dwp-frontend/shared-utils';
import type { QueryKey } from '@tanstack/react-query';

type RetryContext = Readonly<{
  viewVersion?: number;
  deviceVersion?: number | null;
}>;

type PendingMutation = Readonly<{
  baseVersion?: number;
  changeCount: number;
  retry: (context: RetryContext) => void;
}>;

type PendingConflict = Readonly<{
  conflict: HomeViewConflict | null;
  baseVersion?: number;
  changeCount: number;
}>;

function replaceView(views: readonly HomeView[] | undefined, next: HomeView): HomeView[] {
  if (!views) return [next];
  return views.some((view) => view.viewId === next.viewId)
    ? views.map((view) => (view.viewId === next.viewId ? next : view))
    : [...views, next];
}

export function useHomeViewConflictRecovery({
  viewQueryKey,
  selectedView,
}: {
  viewQueryKey: QueryKey;
  selectedView?: HomeView | null;
}) {
  const { t } = useTranslation('homeStudio');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const pendingMutationRef = useRef<PendingMutation | null>(null);
  const deviceQueryKey = ['home-personalization', 'device-layouts', selectedView?.viewId] as const;

  const rememberMutation = (
    retry: (context: RetryContext) => void,
    changeCount = 1,
    baseVersion = selectedView?.version
  ) => {
    pendingMutationRef.current = { retry, changeCount, baseVersion };
  };
  const clearPendingMutation = () => {
    pendingMutationRef.current = null;
  };

  const handleMutationError = async (error: unknown) => {
    const pending = pendingMutationRef.current;
    if (error instanceof HttpError && error.status === 409 && pending) {
      const conflict = parseHomeViewConflict(error.details);
      setPendingConflict({
        conflict,
        baseVersion: conflict?.expectedVersion ?? pending?.baseVersion,
        changeCount: Math.max(conflict?.changedFields.length ?? 0, pending?.changeCount ?? 1),
      });
      toast.error(t('feedback.conflict'));
      return;
    }
    clearPendingMutation();
    toast.error(
      error instanceof HttpError && error.status === 409
        ? t('feedback.conflict')
        : t('feedback.failed')
    );
  };

  const reloadLatest = async () => {
    setPendingConflict(null);
    clearPendingMutation();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: viewQueryKey }),
      queryClient.invalidateQueries({ queryKey: deviceQueryKey }),
      queryClient.invalidateQueries({
        queryKey: ['home-personalization', 'revisions', selectedView?.viewId],
      }),
    ]);
    setReloadToken((current) => current + 1);
  };

  const reapply = async () => {
    const pending = pendingMutationRef.current;
    const conflict = pendingConflict?.conflict;
    if (conflict?.latestView) {
      queryClient.setQueryData<HomeView[]>(viewQueryKey, (current) =>
        replaceView(current, conflict.latestView!)
      );
    } else {
      await queryClient.invalidateQueries({ queryKey: viewQueryKey });
    }
    if (conflict?.latestDeviceLayout) {
      queryClient.setQueryData<HomeDeviceLayout[]>(deviceQueryKey, (current = []) => [
        ...current.filter(
          (layout) => layout.deviceClass !== conflict.latestDeviceLayout!.deviceClass
        ),
        conflict.latestDeviceLayout!,
      ]);
    }
    const context: RetryContext = {
      viewVersion:
        conflict?.actualVersion ?? conflict?.latestView?.version ?? selectedView?.version,
      deviceVersion:
        conflict?.actualDeviceVersion !== undefined
          ? conflict.actualDeviceVersion
          : conflict?.latestDeviceLayout?.version,
    };
    setPendingConflict(null);
    pending?.retry(context);
  };

  return {
    handleMutationError,
    rememberMutation,
    clearPendingMutation,
    reloadToken,
    conflictDialog: (
      <HomePreferenceConflictDialog
        open={Boolean(pendingConflict)}
        changeCount={pendingConflict?.changeCount ?? 1}
        baseVersion={pendingConflict?.baseVersion}
        latestVersion={pendingConflict?.conflict?.actualVersion}
        busy={false}
        canReapply={Boolean(pendingMutationRef.current)}
        onReloadLatest={() => void reloadLatest()}
        onReapply={() => void reapply()}
        onClose={() => {
          setPendingConflict(null);
          clearPendingMutation();
        }}
      />
    ),
  };
}
