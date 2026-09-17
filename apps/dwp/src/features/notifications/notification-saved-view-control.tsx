import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  AtSign,
  Bell,
  Bookmark,
  CircleCheckBig,
  Inbox,
  Pencil,
  Star,
  X,
  Zap,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSavedView,
  deleteSavedView,
  getSavedViews,
  markSavedViewUsed,
  updateSavedView,
  updateSavedViewPreference,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { ConfirmDialog } from '@dwp-frontend/design-system/components/dialogs/confirm-dialog';
import { SavedViewMenu } from '@dwp-frontend/design-system/enterprise/resource/saved-view-menu';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  canonicalNotificationIncludedTypes,
  canonicalNotificationContextFilters,
  NOTIFICATION_INCLUDED_TYPES,
  type NotificationCenterScope,
  type NotificationContextOption,
  type NotificationIncludedType,
} from './notification-filter-model';
import {
  DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
  MAX_NOTIFICATION_PINNED_VIEWS,
  MAX_NOTIFICATION_SAVED_VIEWS,
  notificationSavedViewConfiguration,
  notificationSavedViewConfigurationIdentity,
  orderNotificationSavedViews,
  parseNotificationSavedViewConfiguration,
  reorderNotificationPersonalSavedViews,
  type NotificationCenterPresentation,
  type NotificationSavedViewColor,
} from './notification-saved-view-model';
import {
  NotificationSavedViewEditor,
  type NotificationSavedViewEditorDraft,
} from './notification-saved-view-editor';

import type { GovernedSavedView, SavedViewConfiguration } from '@dwp-frontend/shared-utils';

type BuiltInView = {
  id: string;
  name: string;
  configuration: SavedViewConfiguration;
  isDefault?: boolean;
};

type Props = {
  surfaceKey: string;
  currentScope: NotificationCenterScope;
  currentPresentation: NotificationCenterPresentation;
  appOptions: Array<[string, string]>;
  contextOptions: NotificationContextOption[];
  builtInViews: readonly BuiltInView[];
  selectedBuiltInViewId: string | null;
  onApply: (configuration: SavedViewConfiguration) => void;
};

const SHARED_EDITOR_ROLES = new Set(['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN']);
const EMPTY_VIEWS: GovernedSavedView[] = [];
const SAVED_VIEW_ICON = {
  BELL: Bell,
  INBOX: Inbox,
  AT_SIGN: AtSign,
  BOLT: Zap,
  BOOKMARK: Bookmark,
} as const;
const SAVED_VIEW_COLOR: Record<NotificationSavedViewColor, { foreground: string; tint: string }> = {
  BLUE: {
    foreground: foundationTokens.color.data.cobalt,
    tint: alpha(foundationTokens.color.data.cobalt, 0.12),
  },
  TEAL: {
    foreground: foundationTokens.color.data.teal,
    tint: alpha(foundationTokens.color.data.teal, 0.12),
  },
  VIOLET: {
    foreground: foundationTokens.color.data.violet,
    tint: alpha(foundationTokens.color.data.violet, 0.12),
  },
  AMBER: {
    foreground: foundationTokens.color.data.saffron,
    tint: alpha(foundationTokens.color.data.saffron, 0.12),
  },
  RED: {
    foreground: foundationTokens.color.data.coral,
    tint: alpha(foundationTokens.color.data.coral, 0.12),
  },
};

export function NotificationSavedViewControl({
  surfaceKey,
  currentScope,
  currentPresentation,
  appOptions,
  contextOptions,
  builtInViews,
  selectedBuiltInViewId,
  onApply,
}: Props) {
  const { t } = useTranslation('common');
  const { t: tn } = useTranslation('notifications');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryKey = ['saved-views', surfaceKey] as const;
  const [selectedServerViewId, setSelectedServerViewId] = useState<string | null>(null);
  const [mode, setMode] = useState<'EDITOR' | 'MANAGE' | null>(null);
  const [editing, setEditing] = useState<GovernedSavedView | null>(null);
  const [deleting, setDeleting] = useState<GovernedSavedView | null>(null);
  const [draft, setDraft] = useState<NotificationSavedViewEditorDraft>(() =>
    editorDraft(currentScope, currentPresentation)
  );
  const defaultResolved = useRef(false);
  const currentConfiguration = notificationSavedViewConfiguration(
    currentScope,
    currentPresentation
  );
  const configurationSignature = notificationSavedViewConfigurationIdentity(currentConfiguration);
  const groups = auth.user?.groups ?? [];
  const canPublish = Boolean(
    auth.user?.roles.some((role) => SHARED_EDITOR_ROLES.has(role.toUpperCase()))
  );

  const viewsQuery = useQuery({
    queryKey,
    queryFn: () => getSavedViews(surfaceKey),
    staleTime: 60_000,
  });
  const views = viewsQuery.data ?? EMPTY_VIEWS;
  const orderedViews = useMemo(() => orderNotificationSavedViews(views), [views]);
  const editableViewCount = views.filter((view) => view.editable).length;
  const pinnedViewCount = views.filter((view) => view.favorite).length;
  const matchedServerViewId = useMemo(
    () =>
      views.find(
        (view) =>
          notificationSavedViewConfigurationIdentity(view.configuration) === configurationSignature
      )?.savedViewId ?? null,
    [configurationSignature, views]
  );
  const activeViewId = selectedServerViewId ?? matchedServerViewId;

  useEffect(() => {
    if (!selectedServerViewId) return;
    const selected = views.find((view) => view.savedViewId === selectedServerViewId);
    if (
      !selected ||
      notificationSavedViewConfigurationIdentity(selected.configuration) !== configurationSignature
    ) {
      setSelectedServerViewId(null);
    }
  }, [configurationSignature, selectedServerViewId, views]);

  useEffect(() => {
    if (defaultResolved.current || viewsQuery.isLoading) return;
    defaultResolved.current = true;
    if (!builtInViews.find((view) => view.id === selectedBuiltInViewId)?.isDefault) return;
    const preferred = views.find((view) => view.defaultView);
    if (!preferred) return;
    setSelectedServerViewId(preferred.savedViewId);
    onApply(preferred.configuration);
    void markSavedViewUsed(preferred.savedViewId);
  }, [builtInViews, onApply, selectedBuiltInViewId, views, viewsQuery.isLoading]);

  const refresh = async () => queryClient.invalidateQueries({ queryKey });
  const createMutation = useMutation({
    mutationFn: () => {
      if (editableViewCount >= MAX_NOTIFICATION_SAVED_VIEWS) {
        throw new Error('Notification saved view capacity reached.');
      }
      if (draft.favorite && pinnedViewCount >= MAX_NOTIFICATION_PINNED_VIEWS) {
        throw new Error('Notification pinned saved view capacity reached.');
      }
      return createSavedView(surfaceKey, {
        name: draft.name.trim(),
        scope: draft.visibility,
        ownerGroupRef: draft.visibility === 'TEAM' ? draft.ownerGroupRef : null,
        configuration: notificationSavedViewConfiguration(draft.scope, draft.presentation),
        favorite: draft.favorite,
        defaultView: draft.defaultView,
      });
    },
    onSuccess: async (created) => {
      queryClient.setQueryData<GovernedSavedView[]>(queryKey, (current = []) => [
        created,
        ...current.filter((view) => view.savedViewId !== created.savedViewId),
      ]);
      onApply(created.configuration);
      setSelectedServerViewId(created.savedViewId);
      setMode(null);
      toast.success(t('savedViews.feedback.created'));
      await refresh();
    },
    onError: () => toast.error(t('savedViews.feedback.saveFailed')),
  });
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No notification saved view is selected.');
      return updateSavedView(editing.savedViewId, {
        name: draft.name.trim(),
        scope: draft.visibility,
        ownerGroupRef: draft.visibility === 'TEAM' ? draft.ownerGroupRef : null,
        configuration: notificationSavedViewConfiguration(draft.scope, draft.presentation),
        version: editing.version,
      });
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData<GovernedSavedView[]>(queryKey, (current = []) =>
        current.map((view) => (view.savedViewId === updated.savedViewId ? updated : view))
      );
      onApply(updated.configuration);
      setSelectedServerViewId(updated.savedViewId);
      setMode(null);
      setEditing(null);
      toast.success(t('savedViews.feedback.updated'));
      await refresh();
    },
    onError: () => toast.error(t('savedViews.feedback.saveFailed')),
  });
  const preferenceMutation = useMutation({
    mutationFn: ({
      view,
      favorite,
      defaultView,
    }: {
      view: GovernedSavedView;
      favorite: boolean;
      defaultView: boolean;
    }) => {
      if (favorite && !view.favorite && pinnedViewCount >= MAX_NOTIFICATION_PINNED_VIEWS) {
        throw new Error('Notification pinned saved view capacity reached.');
      }
      return updateSavedViewPreference(view.savedViewId, { favorite, defaultView });
    },
    onMutate: async ({ view, favorite, defaultView }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<GovernedSavedView[]>(queryKey);
      queryClient.setQueryData<GovernedSavedView[]>(queryKey, (current = []) =>
        current.map((candidate) =>
          candidate.savedViewId === view.savedViewId
            ? { ...candidate, favorite, defaultView }
            : candidate
        )
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(t('savedViews.feedback.preferenceFailed'));
    },
    onSettled: refresh,
  });
  const reorderMutation = useMutation({
    mutationFn: async ({ view, direction }: { view: GovernedSavedView; direction: -1 | 1 }) => {
      const updates = reorderNotificationPersonalSavedViews(views, view.savedViewId, direction);
      return Promise.all(
        updates.map((update) =>
          updateSavedView(update.view.savedViewId, {
            name: update.view.name,
            scope: update.view.scope,
            ownerGroupRef: update.view.ownerGroupRef ?? null,
            configuration: update.configuration,
            version: update.view.version,
          })
        )
      );
    },
    onMutate: async ({ view, direction }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<GovernedSavedView[]>(queryKey);
      const updates = reorderNotificationPersonalSavedViews(views, view.savedViewId, direction);
      const configurations = new Map(
        updates.map((update) => [update.view.savedViewId, update.configuration])
      );
      queryClient.setQueryData<GovernedSavedView[]>(queryKey, (current = []) =>
        current.map((candidate) => ({
          ...candidate,
          configuration: configurations.get(candidate.savedViewId) ?? candidate.configuration,
        }))
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(t('savedViews.feedback.saveFailed'));
    },
    onSettled: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: (view: GovernedSavedView) => deleteSavedView(view.savedViewId),
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
      toast.success(t('savedViews.feedback.deleted'));
    },
    onError: () => toast.error(t('savedViews.feedback.deleteFailed')),
  });

  const menuViews = [
    ...builtInViews.map((view) => ({
      id: view.id,
      name: view.name,
      scope: 'personal' as const,
      isDefault: view.isDefault,
      builtIn: true,
    })),
    ...orderedViews.map((view) => ({
      id: view.savedViewId,
      name: view.name,
      scope: view.scope === 'PERSONAL' ? ('personal' as const) : ('shared' as const),
      favorite: view.favorite,
      isDefault: view.defaultView,
    })),
  ];
  const busy = createMutation.isPending || updateMutation.isPending;
  const activeServerView = views.find((view) => view.savedViewId === activeViewId);
  const activePresentation = activeServerView
    ? parseNotificationSavedViewConfiguration(activeServerView.configuration)?.presentation
    : null;
  const ActiveViewIcon = activePresentation ? SAVED_VIEW_ICON[activePresentation.icon] : null;

  const beginCreate = () => {
    setEditing(null);
    setDraft({
      ...editorDraft(currentScope, currentPresentation),
      presentation: {
        ...currentPresentation,
        displayOrder: Math.min(99, editableViewCount),
      },
    });
    setMode('EDITOR');
  };
  const beginEdit = (view: GovernedSavedView) => {
    const parsed = parseNotificationSavedViewConfiguration(view.configuration);
    if (!parsed) {
      toast.error(tn('savedViews.invalid'));
      return;
    }
    setEditing(view);
    setDraft({
      name: view.name,
      visibility: view.scope,
      ownerGroupRef: view.ownerGroupRef ?? '',
      favorite: view.favorite,
      defaultView: view.defaultView,
      scope: parsed.scope,
      presentation: parsed.presentation,
    });
    setMode('EDITOR');
  };
  const applyView = (id: string) => {
    const builtIn = builtInViews.find((view) => view.id === id);
    if (builtIn) {
      setSelectedServerViewId(null);
      onApply(builtIn.configuration);
      return;
    }
    const selected = views.find((view) => view.savedViewId === id);
    if (!selected) return;
    setSelectedServerViewId(selected.savedViewId);
    onApply(selected.configuration);
    void markSavedViewUsed(selected.savedViewId);
  };

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        {ActiveViewIcon && activePresentation ? (
          <Box
            aria-label={tn('savedViews.activeStyle', { defaultValue: '활성 저장 보기 스타일' })}
            sx={{
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              borderRadius: foundationTokens.radius.control,
              color: SAVED_VIEW_COLOR[activePresentation.color].foreground,
              bgcolor: SAVED_VIEW_COLOR[activePresentation.color].tint,
            }}
          >
            <ActiveViewIcon size={15} aria-hidden="true" />
          </Box>
        ) : null}
        <SavedViewMenu
          label={t('savedViews.label')}
          personalLabel={t('savedViews.scope.personal')}
          sharedLabel={t('savedViews.scope.organization')}
          builtInLabel={t('savedViews.scope.builtIn')}
          defaultLabel={t('savedViews.default')}
          emptyLabel={viewsQuery.isLoading ? t('savedViews.loading') : t('savedViews.empty')}
          saveCurrentLabel={t('savedViews.saveCurrent')}
          manageLabel={t('savedViews.manage')}
          selectedViewId={activeViewId ?? selectedBuiltInViewId}
          views={menuViews}
          loading={viewsQuery.isLoading}
          canSave={
            editableViewCount < MAX_NOTIFICATION_SAVED_VIEWS &&
            canonicalNotificationContextFilters(currentScope.contextFilters) !== null &&
            canonicalNotificationIncludedTypes(currentScope.includedTypes) !== null
          }
          onSelect={(view) => applyView(view.id)}
          onSaveCurrent={beginCreate}
          onManage={() => setMode('MANAGE')}
        />
      </Stack>

      <Drawer
        anchor={mobile ? 'bottom' : 'right'}
        open={mode !== null}
        onClose={() => setMode(null)}
        slotProps={{
          paper: {
            sx: mobile
              ? {
                  maxHeight: '88dvh',
                  borderTopLeftRadius: foundationTokens.radius.surface,
                  borderTopRightRadius: foundationTokens.radius.surface,
                }
              : { width: 520, maxWidth: '100%' },
          },
        }}
      >
        {mode === 'EDITOR' ? (
          <NotificationSavedViewEditor
            editing={Boolean(editing)}
            draft={draft}
            busy={busy}
            canPublish={canPublish}
            groups={groups}
            appOptions={appOptions}
            contextOptions={contextOptions}
            onChange={setDraft}
            onClose={() => setMode(null)}
            onSubmit={() => {
              if (editing) void updateMutation.mutateAsync();
              else void createMutation.mutateAsync();
            }}
          />
        ) : (
          renderManager()
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('savedViews.deleteDialog.title')}
        description={t('savedViews.deleteDialog.description', { name: deleting?.name })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.delete')}
        confirmingLabel={t('savedViews.deleting')}
        intent="danger"
        busy={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting);
        }}
      />
    </>
  );

  function renderManager() {
    return (
      <Box sx={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', height: '100%' }}>
        {drawerHeader(t('savedViews.manager.title'))}
        <Box sx={{ p: 2.5, overflowY: 'auto' }}>
          <Typography variant="caption" color="text.secondary">
            {tn('savedViews.capacity', {
              current: editableViewCount,
              maximum: MAX_NOTIFICATION_SAVED_VIEWS,
            })}
          </Typography>
          {views.length === 0 ? (
            <Typography color="text.secondary">{t('savedViews.empty')}</Typography>
          ) : (
            orderedViews.map((view, index) => (
              <Box key={view.savedViewId}>
                {index > 0 && <Divider />}
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={1}
                  role="group"
                  aria-label={view.name}
                  data-testid="notification-saved-view-row"
                  sx={{ py: 1.5 }}
                >
                  <Box minWidth={0} flex={1}>
                    <Typography variant="subtitle2" noWrap>
                      {view.name}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(
                        `savedViews.scope.${view.scope === 'TENANT' ? 'organization' : view.scope.toLocaleLowerCase()}`
                      )}
                    />
                  </Box>
                  <ActionIconButton
                    label={
                      view.favorite
                        ? t('savedViews.manager.removeFavorite')
                        : t('savedViews.manager.addFavorite')
                    }
                    disabled={
                      preferenceMutation.isPending ||
                      (!view.favorite && pinnedViewCount >= MAX_NOTIFICATION_PINNED_VIEWS)
                    }
                    onClick={() =>
                      preferenceMutation.mutate({
                        view,
                        favorite: !view.favorite,
                        defaultView: view.defaultView,
                      })
                    }
                  >
                    <Star size={17} fill={view.favorite ? 'currentColor' : 'none'} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={
                      view.defaultView
                        ? t('savedViews.manager.removeDefault')
                        : t('savedViews.manager.makeDefault')
                    }
                    disabled={preferenceMutation.isPending}
                    onClick={() =>
                      preferenceMutation.mutate({
                        view,
                        favorite: view.favorite,
                        defaultView: !view.defaultView,
                      })
                    }
                  >
                    <CircleCheckBig size={17} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={tn('savedViews.moveUp', { defaultValue: '위로 이동' })}
                    disabled={
                      reorderMutation.isPending ||
                      reorderNotificationPersonalSavedViews(views, view.savedViewId, -1).length ===
                        0
                    }
                    onClick={() => reorderMutation.mutate({ view, direction: -1 })}
                  >
                    <ArrowUp size={17} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={tn('savedViews.moveDown', { defaultValue: '아래로 이동' })}
                    disabled={
                      reorderMutation.isPending ||
                      reorderNotificationPersonalSavedViews(views, view.savedViewId, 1).length === 0
                    }
                    onClick={() => reorderMutation.mutate({ view, direction: 1 })}
                  >
                    <ArrowDown size={17} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('savedViews.manager.edit')}
                    disabled={!view.editable}
                    onClick={() => beginEdit(view)}
                  >
                    <Pencil size={17} />
                  </ActionIconButton>
                  <ActionIconButton
                    label={t('savedViews.manager.delete')}
                    intent="danger"
                    disabled={!view.editable}
                    onClick={() => setDeleting(view)}
                  >
                    <Archive size={17} />
                  </ActionIconButton>
                </Stack>
              </Box>
            ))
          )}
        </Box>
      </Box>
    );
  }

  function drawerHeader(title: string) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography component="h2" variant="h6">
          {title}
        </Typography>
        <ActionIconButton label={t('actions.close')} onClick={() => setMode(null)}>
          <X size={18} />
        </ActionIconButton>
      </Stack>
    );
  }
}

function editorDraft(
  scope: NotificationCenterScope,
  presentation: NotificationCenterPresentation
): NotificationSavedViewEditorDraft {
  const migratedTypes =
    scope.includedTypes.length > 0 ? scope.includedTypes : includedTypesForReason(scope.reason);
  return {
    name: '',
    visibility: 'PERSONAL',
    ownerGroupRef: '',
    favorite: false,
    defaultView: false,
    scope: {
      ...scope,
      reason: migratedTypes.length > 0 ? 'ALL' : scope.reason,
      includedTypes: [...migratedTypes],
      contextFilters: scope.contextFilters.map((context) => ({ ...context })),
    },
    presentation: { ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION, ...presentation },
  };
}

function includedTypesForReason(
  reason: NotificationCenterScope['reason']
): NotificationIncludedType[] {
  if (reason === 'ROLE') return ['ASSIGNED'];
  if (NOTIFICATION_INCLUDED_TYPES.includes(reason as NotificationIncludedType)) {
    return [reason as NotificationIncludedType];
  }
  return [];
}
