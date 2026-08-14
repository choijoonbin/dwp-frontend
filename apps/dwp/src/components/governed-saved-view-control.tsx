import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Building2,
  CircleCheckBig,
  Pencil,
  Star,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  ActionIconButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  SavedViewMenu,
  SelectField,
} from '@dwp-frontend/design-system';
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

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  GovernedSavedView,
  SavedViewConfiguration,
  SavedViewScope,
} from '@dwp-frontend/shared-utils';

export type BuiltInSavedView = {
  id: string;
  name: string;
  configuration: SavedViewConfiguration;
  isDefault?: boolean;
};

type GovernedSavedViewControlProps = {
  surfaceKey: string;
  currentConfiguration: SavedViewConfiguration;
  builtInViews?: readonly BuiltInSavedView[];
  selectedBuiltInViewId?: string | null;
  onApply: (configuration: SavedViewConfiguration) => void;
};

type EditorDraft = {
  name: string;
  scope: SavedViewScope;
  ownerGroupRef: string;
  favorite: boolean;
  defaultView: boolean;
};

const EMPTY_DRAFT: EditorDraft = {
  name: '',
  scope: 'PERSONAL',
  ownerGroupRef: '',
  favorite: false,
  defaultView: false,
};

const SHARED_EDITOR_ROLES = new Set(['ADMIN', 'TENANT_ADMIN', 'PLATFORM_ADMIN']);
const EMPTY_VIEWS: GovernedSavedView[] = [];
const EMPTY_GROUPS: Array<{ groupRef: string; displayName: string }> = [];

export function GovernedSavedViewControl({
  surfaceKey,
  currentConfiguration,
  builtInViews = [],
  selectedBuiltInViewId,
  onApply,
}: GovernedSavedViewControlProps) {
  const { t } = useTranslation('common');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['saved-views', surfaceKey] as const;
  const [selectedServerViewId, setSelectedServerViewId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<GovernedSavedView | null>(null);
  const [deleting, setDeleting] = useState<GovernedSavedView | null>(null);
  const [draft, setDraft] = useState<EditorDraft>(EMPTY_DRAFT);
  const defaultResolved = useRef(false);
  const configurationSignature = JSON.stringify(currentConfiguration);

  const viewsQuery = useQuery({
    queryKey,
    queryFn: () => getSavedViews(surfaceKey),
    staleTime: 60_000,
  });
  const views = viewsQuery.data ?? EMPTY_VIEWS;
  const canPublish = Boolean(
    auth.user?.roles.some((role) => SHARED_EDITOR_ROLES.has(role.toUpperCase()))
  );
  const canMakePersonal = !editing || editing.ownerUserId === auth.user?.userId;
  const groups = auth.user?.groups ?? EMPTY_GROUPS;
  const groupNames = useMemo(
    () => new Map(groups.map((group) => [group.groupRef, group.displayName])),
    [groups]
  );

  useEffect(() => {
    if (!selectedServerViewId) return;
    const selected = views.find((view) => view.savedViewId === selectedServerViewId);
    if (!selected || JSON.stringify(selected.configuration) !== configurationSignature) {
      setSelectedServerViewId(null);
    }
  }, [configurationSignature, selectedServerViewId, views]);

  useEffect(() => {
    if (defaultResolved.current || viewsQuery.isLoading) return;
    const selectedBuiltIn = builtInViews.find((view) => view.id === selectedBuiltInViewId);
    if (!selectedBuiltIn?.isDefault) {
      defaultResolved.current = true;
      return;
    }
    const preferred = views.find((view) => view.defaultView);
    defaultResolved.current = true;
    if (!preferred) return;
    setSelectedServerViewId(preferred.savedViewId);
    onApply(preferred.configuration);
    void markSavedViewUsed(preferred.savedViewId);
  }, [builtInViews, onApply, selectedBuiltInViewId, views, viewsQuery.isLoading]);

  const refresh = async () => queryClient.invalidateQueries({ queryKey });
  const createMutation = useMutation({
    mutationFn: () =>
      createSavedView(surfaceKey, {
        name: draft.name.trim(),
        scope: draft.scope,
        ownerGroupRef: draft.scope === 'TEAM' ? draft.ownerGroupRef : null,
        configuration: currentConfiguration,
        favorite: draft.favorite,
        defaultView: draft.defaultView,
      }),
    onSuccess: async (created) => {
      await refresh();
      setSelectedServerViewId(created.savedViewId);
      setEditorOpen(false);
      toast.success(t('savedViews.feedback.created'));
    },
    onError: () => toast.error(t('savedViews.feedback.saveFailed')),
  });
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No saved view is selected.');
      return updateSavedView(editing.savedViewId, {
        name: draft.name.trim(),
        scope: draft.scope,
        ownerGroupRef: draft.scope === 'TEAM' ? draft.ownerGroupRef : null,
        configuration: editing.configuration,
        version: editing.version,
      });
    },
    onSuccess: async () => {
      await refresh();
      setEditorOpen(false);
      setEditing(null);
      toast.success(t('savedViews.feedback.updated'));
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
    }) => updateSavedViewPreference(view.savedViewId, { favorite, defaultView }),
    onSuccess: async () => refresh(),
    onError: () => toast.error(t('savedViews.feedback.preferenceFailed')),
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

  const menuViews = useMemo(
    () => [
      ...builtInViews.map((view) => ({
        id: view.id,
        name: view.name,
        scope: 'personal' as const,
        isDefault: view.isDefault,
        builtIn: true,
      })),
      ...views.map((view) => ({
        id: view.savedViewId,
        name: view.name,
        scope: view.scope === 'PERSONAL' ? ('personal' as const) : ('shared' as const),
        owner:
          view.scope === 'TENANT'
            ? t('savedViews.owner.organization')
            : view.scope === 'TEAM'
              ? t('savedViews.owner.team', {
                  name: groupNames.get(view.ownerGroupRef ?? '') ?? t('savedViews.scope.team'),
                })
              : t('savedViews.owner.personal'),
        favorite: view.favorite,
        isDefault: view.defaultView,
      })),
    ],
    [builtInViews, groupNames, t, views]
  );

  const beginCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  };
  const beginEdit = (view: GovernedSavedView) => {
    setEditing(view);
    setDraft({
      name: view.name,
      scope: view.scope,
      ownerGroupRef: view.ownerGroupRef ?? '',
      favorite: view.favorite,
      defaultView: view.defaultView,
    });
    setManageOpen(false);
    setEditorOpen(true);
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

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <SavedViewMenu
        label={t('savedViews.label')}
        personalLabel={t('savedViews.scope.personal')}
        sharedLabel={t('savedViews.scope.organization')}
        builtInLabel={t('savedViews.scope.builtIn')}
        defaultLabel={t('savedViews.default')}
        emptyLabel={viewsQuery.isLoading ? t('savedViews.loading') : t('savedViews.empty')}
        saveCurrentLabel={t('savedViews.saveCurrent')}
        manageLabel={t('savedViews.manage')}
        selectedViewId={selectedServerViewId ?? selectedBuiltInViewId}
        views={menuViews}
        loading={viewsQuery.isLoading}
        canSave
        onSelect={(view) => applyView(view.id)}
        onSaveCurrent={beginCreate}
        onManage={() => setManageOpen(true)}
      />

      <FormDialog
        open={editorOpen}
        title={editing ? t('savedViews.editor.editTitle') : t('savedViews.editor.createTitle')}
        description={t('savedViews.editor.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={editing ? t('actions.save') : t('actions.create')}
        submittingLabel={t('savedViews.saving')}
        busy={busy}
        submitDisabled={!draft.name.trim() || (draft.scope === 'TEAM' && !draft.ownerGroupRef)}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSubmit={async () => {
          if (editing) await updateMutation.mutateAsync();
          else await createMutation.mutateAsync();
        }}
      >
        <Box sx={{ display: 'grid', gap: 2.5 }}>
          <FormField
            autoFocus
            label={t('savedViews.editor.name')}
            value={draft.name}
            inputProps={{ maxLength: 160 }}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.75 }}
            >
              {t('savedViews.editor.visibility')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={draft.scope}
              onChange={(_event, value: SavedViewScope | null) =>
                value && setDraft((current) => ({ ...current, scope: value }))
              }
            >
              <ToggleButton value="PERSONAL" disabled={!canMakePersonal}>
                <UserRound size={16} aria-hidden="true" />
                <Box component="span" sx={{ ml: 0.75 }}>
                  {t('savedViews.scope.personal')}
                </Box>
              </ToggleButton>
              {groups.length > 0 && (
                <ToggleButton value="TEAM" disabled={!canMakePersonal}>
                  <UsersRound size={16} aria-hidden="true" />
                  <Box component="span" sx={{ ml: 0.75 }}>
                    {t('savedViews.scope.team')}
                  </Box>
                </ToggleButton>
              )}
              <ToggleButton value="TENANT" disabled={!canPublish}>
                <Building2 size={16} aria-hidden="true" />
                <Box component="span" sx={{ ml: 0.75 }}>
                  {t('savedViews.scope.organization')}
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
            {draft.scope === 'TEAM' && (
              <SelectField
                label={t('savedViews.editor.team')}
                value={draft.ownerGroupRef}
                options={groups.map((group) => ({
                  value: group.groupRef,
                  label: group.displayName,
                }))}
                placeholder={t('savedViews.editor.teamPlaceholder')}
                onValueChange={(ownerGroupRef) =>
                  setDraft((current) => ({ ...current, ownerGroupRef: String(ownerGroupRef) }))
                }
                sx={{ mt: 1.5 }}
              />
            )}
            {!canPublish && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75 }}
              >
                {t('savedViews.editor.organizationHint')}
              </Typography>
            )}
            {!canMakePersonal && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75 }}
              >
                {t('savedViews.editor.personalOwnerHint')}
              </Typography>
            )}
          </Box>
          {!editing && (
            <Box sx={{ display: 'grid' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.favorite}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, favorite: event.target.checked }))
                    }
                  />
                }
                label={t('savedViews.editor.favorite')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.defaultView}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, defaultView: event.target.checked }))
                    }
                  />
                }
                label={t('savedViews.editor.defaultView')}
              />
            </Box>
          )}
        </Box>
      </FormDialog>

      <FormDialog
        open={manageOpen}
        title={t('savedViews.manager.title')}
        description={t('savedViews.manager.description')}
        cancelLabel={t('actions.close')}
        submitLabel={t('actions.close')}
        submitIntent="secondary"
        showCancel={false}
        onClose={() => setManageOpen(false)}
        onSubmit={() => setManageOpen(false)}
      >
        {views.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {t('savedViews.empty')}
          </Typography>
        ) : (
          <Box>
            {views.map((view, index) => (
              <Box key={view.savedViewId}>
                {index > 0 && <Divider />}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {view.name}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        mt: 0.5,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Chip
                        size="small"
                        variant="outlined"
                        label={
                          view.scope === 'TENANT'
                            ? t('savedViews.scope.organization')
                            : view.scope === 'TEAM'
                              ? t('savedViews.scope.team')
                              : t('savedViews.scope.personal')
                        }
                      />
                      {view.defaultView && <Chip size="small" label={t('savedViews.default')} />}
                      {!view.editable && (
                        <Typography variant="caption" color="text.secondary">
                          {t('savedViews.manager.readOnly')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ActionIconButton
                      label={
                        view.favorite
                          ? t('savedViews.manager.removeFavorite')
                          : t('savedViews.manager.addFavorite')
                      }
                      intent={view.favorite ? 'primary' : 'default'}
                      loading={preferenceMutation.isPending}
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
                      intent={view.defaultView ? 'primary' : 'default'}
                      loading={preferenceMutation.isPending}
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
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </FormDialog>

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
}
