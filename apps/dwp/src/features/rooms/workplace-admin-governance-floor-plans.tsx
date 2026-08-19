import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveRestore, CheckCheck, FilePlus2, FileStack, Pencil, Send, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorkplaceGovernanceFloorPlanRevision,
  getWorkplaceAdminFloors,
  getWorkplaceAdminResources,
  getWorkplaceAdminSites,
  getWorkplaceGovernanceFloorPlanProjection,
  getWorkplaceGovernanceFloorPlanRevisionSnapshot,
  getWorkplaceGovernanceFloorPlanRevisions,
  getWorkplaceGovernanceZones,
  publishWorkplaceGovernanceFloorPlan,
  restoreWorkplaceGovernanceFloorPlanRevision,
  submitWorkplaceGovernanceFloorPlanReview,
  updateWorkplaceGovernanceFloorPlanRevision,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceGovernanceRevisionActions } from './workplace-admin-governance-model';
import { WorkplaceLayoutEditor } from './workplace-layout-editor';
import {
  GovernanceEmpty,
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';

import type {
  WorkplaceGovernanceFloorPlanRevision,
  WorkplaceGovernanceRevisionState,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

type TransitionAction = 'REVIEW' | 'PUBLISH' | 'RESTORE';
type DraftExitIntent =
  | { type: 'CLOSE' }
  | { type: 'EDIT'; revisionId: string }
  | {
      type: 'TRANSITION';
      revision: WorkplaceGovernanceFloorPlanRevision;
      action: TransitionAction;
    };

function revisionColor(state: WorkplaceGovernanceRevisionState) {
  if (state === 'PUBLISHED') return 'success';
  if (state === 'REVIEW') return 'warning';
  if (state === 'DRAFT') return 'info';
  return 'default';
}

export function WorkplaceAdminGovernanceFloorPlans({
  canManage,
  onDirtyChange,
}: {
  canManage: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const [siteId, setSiteId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [basedOnRevisionId, setBasedOnRevisionId] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [editingRevisionId, setEditingRevisionId] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [pendingDraftExit, setPendingDraftExit] = useState<DraftExitIntent | null>(null);
  const [transition, setTransition] = useState<{
    revision: WorkplaceGovernanceFloorPlanRevision;
    action: TransitionAction;
  } | null>(null);
  const [reason, setReason] = useState('');
  const handleDraftDirty = useCallback(
    (dirty: boolean) => {
      setDraftDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange]
  );
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites'],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
    retry: 1,
  });
  const sites = useMemo(() => sitesQuery.data ?? [], [sitesQuery.data]);
  useEffect(() => {
    if (sites.length && !sites.some((site) => site.siteId === siteId)) setSiteId(sites[0].siteId);
  }, [siteId, sites]);
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'admin', 'floors', siteId],
    queryFn: () => getWorkplaceAdminFloors(siteId),
    enabled: Boolean(siteId),
    staleTime: 30_000,
    retry: 1,
  });
  const floors = useMemo(() => floorsQuery.data ?? [], [floorsQuery.data]);
  useEffect(() => {
    if (!floors.length) setFloorId('');
    else if (!floors.some((floor) => floor.floorId === floorId)) setFloorId(floors[0].floorId);
  }, [floorId, floors]);
  useEffect(() => setEditingRevisionId(''), [floorId]);
  const revisionsQuery = useQuery({
    queryKey: ['workplace', 'governance', 'floor-plan-revisions', floorId],
    queryFn: () => getWorkplaceGovernanceFloorPlanRevisions(floorId),
    enabled: Boolean(floorId),
    staleTime: 10_000,
    retry: 1,
  });
  const projectionQuery = useQuery({
    queryKey: ['workplace', 'governance', 'floor-plan-projection', floorId],
    queryFn: () => getWorkplaceGovernanceFloorPlanProjection(floorId),
    enabled: Boolean(floorId),
    staleTime: 15_000,
    retry: false,
  });
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'resources', floorId],
    queryFn: () => getWorkplaceAdminResources(floorId),
    enabled: Boolean(floorId && editingRevisionId),
    staleTime: 20_000,
    retry: 1,
  });
  const snapshotQuery = useQuery({
    queryKey: ['workplace', 'governance', 'floor-plan-snapshot', editingRevisionId],
    queryFn: () => getWorkplaceGovernanceFloorPlanRevisionSnapshot(editingRevisionId),
    enabled: Boolean(editingRevisionId),
    staleTime: 5_000,
    retry: 1,
  });
  const zonesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'zones', floorId],
    queryFn: () => getWorkplaceGovernanceZones(floorId),
    enabled: Boolean(floorId && editingRevisionId),
    staleTime: 20_000,
    retry: 1,
  });
  const revisions = revisionsQuery.data ?? [];
  const hasPublishedRevision = revisions.some((revision) => revision.state === 'PUBLISHED');
  const restorable = revisions.filter(
    (revision) => revision.state === 'PUBLISHED' || revision.state === 'ARCHIVED'
  );

  const createMutation = useMutation({
    mutationFn: () => {
      if (!canManage || !floorId || !changeSummary.trim()) throw new Error('Invalid draft');
      return createWorkplaceGovernanceFloorPlanRevision(floorId, {
        basedOnRevisionId: basedOnRevisionId || null,
        changeSummary: changeSummary.trim(),
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setBasedOnRevisionId('');
      setChangeSummary('');
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'governance', 'floor-plan-revisions', floorId],
      });
      toast.success(t('workplace.admin.governance.floorPlans.created'));
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
  });
  const transitionMutation = useMutation({
    mutationFn: (command: {
      revision: WorkplaceGovernanceFloorPlanRevision;
      action: TransitionAction;
    }) => {
      if (!canManage || !reason.trim()) throw new Error('Invalid transition');
      const { revision, action } = command;
      if (action === 'REVIEW') {
        return submitWorkplaceGovernanceFloorPlanReview(
          revision.revisionId,
          revision.version,
          reason.trim()
        );
      }
      if (action === 'PUBLISH') {
        return publishWorkplaceGovernanceFloorPlan(
          revision.revisionId,
          revision.version,
          reason.trim()
        );
      }
      return restoreWorkplaceGovernanceFloorPlanRevision(
        revision.revisionId,
        revision.version,
        reason.trim()
      );
    },
    onSuccess: async (_, variables) => {
      setTransition(null);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'governance'] });
      toast.success(
        t(`workplace.admin.governance.floorPlans.transitionSuccess.${variables.action}`)
      );
    },
    onError: () => toast.error(t('workplace.admin.governance.common.saveError')),
  });

  if (sitesQuery.isLoading) return <GovernanceLoading rows={6} />;
  if (sitesQuery.isError) return <GovernanceQueryError retry={() => void sitesQuery.refetch()} />;

  const formatInstant = (value: string | null) =>
    value
      ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale)
      : t('workplace.admin.governance.common.notAvailable');

  const snapshot = snapshotQuery.data;
  const selectedFloor = floors.find((floor) => floor.floorId === floorId) ?? null;
  const placementByResource = new Map(
    (snapshot?.placements ?? []).map((placement) => [placement.resourceId, placement])
  );
  const draftResources = (resourcesQuery.data ?? [])
    .filter((resource) => placementByResource.has(resource.resourceId))
    .map((resource) => {
      const placement = placementByResource.get(resource.resourceId)!;
      return {
        ...resource,
        positionX: placement.positionX,
        positionY: placement.positionY,
        widthPercent: placement.widthPercent,
        heightPercent: placement.heightPercent,
        rotationDegrees: placement.rotationDegrees,
      };
    });
  const draftFloor =
    selectedFloor && snapshot
      ? {
          ...selectedFloor,
          planWidth: snapshot.revision.planWidth,
          planHeight: snapshot.revision.planHeight,
          backgroundAssetPath: snapshot.revision.backgroundAssetPath,
        }
      : null;
  const saveDraftLayout = async (resources: readonly WorkplaceResource[]) => {
    if (!snapshot) throw new Error('Draft snapshot is unavailable');
    await updateWorkplaceGovernanceFloorPlanRevision(snapshot.revision.revisionId, {
      planWidth: snapshot.revision.planWidth,
      planHeight: snapshot.revision.planHeight,
      backgroundAssetPath: snapshot.revision.backgroundAssetPath,
      backgroundAssetKey: snapshot.revision.backgroundAssetKey,
      backgroundContentType: snapshot.revision.backgroundContentType,
      backgroundSizeBytes: snapshot.revision.backgroundSizeBytes,
      backgroundSha256: snapshot.revision.backgroundSha256,
      changeSummary: snapshot.revision.changeSummary,
      placements: resources.map((resource) => {
        const placement = placementByResource.get(resource.resourceId);
        const defaultZone = zonesQuery.data?.[0];
        if (!placement && !defaultZone) throw new Error('A floor-plan zone is required');
        return {
          resourceId: resource.resourceId,
          resourceVersion: placement?.resourceVersion ?? resource.version,
          zoneId: placement?.zoneId ?? defaultZone!.zoneId,
          sectionId: placement?.sectionId ?? null,
          positionX: resource.positionX,
          positionY: resource.positionY,
          widthPercent: resource.widthPercent,
          heightPercent: resource.heightPercent,
          rotationDegrees: resource.rotationDegrees,
          metadata: placement?.metadata ?? {},
        };
      }),
      version: snapshot.revision.version,
    });
  };
  const applyDraftExit = (intent: DraftExitIntent) => {
    handleDraftDirty(false);
    if (intent.type === 'CLOSE') {
      setEditingRevisionId('');
      return;
    }
    if (intent.type === 'EDIT') {
      setEditingRevisionId(intent.revisionId);
      return;
    }
    setReason('');
    setTransition({ revision: intent.revision, action: intent.action });
  };
  const requestDraftExit = (intent: DraftExitIntent) => {
    if (draftDirty) setPendingDraftExit(intent);
    else applyDraftExit(intent);
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('workplace.admin.governance.floorPlans.lifecycleNotice')}</Alert>
      <GovernancePanel
        title={t('workplace.admin.governance.floorPlans.context')}
        description={t('workplace.admin.governance.floorPlans.contextDescription')}
      >
        <Box
          sx={{
            p: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
          }}
        >
          <SelectField
            label={t('workplace.admin.governance.fields.site')}
            value={siteId}
            disabled={draftDirty}
            options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
            onValueChange={(value) => {
              setSiteId(value);
              setFloorId('');
            }}
          />
          <SelectField
            label={t('workplace.admin.governance.fields.floor')}
            value={floorId}
            disabled={draftDirty}
            options={floors.map((floor) => ({ value: floor.floorId, label: floor.name }))}
            onValueChange={setFloorId}
          />
        </Box>
      </GovernancePanel>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(280px, 0.7fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <GovernancePanel
          title={t('workplace.admin.governance.floorPlans.revisions')}
          description={t('workplace.admin.governance.floorPlans.revisionsDescription')}
          actions={
            canManage && floorId ? (
              <ActionButton
                intent="primary"
                startIcon={<FilePlus2 size={16} />}
                onClick={() => setCreateOpen(true)}
              >
                {t('workplace.admin.governance.floorPlans.createDraft')}
              </ActionButton>
            ) : null
          }
        >
          {revisionsQuery.isLoading ? (
            <GovernanceLoading rows={5} />
          ) : revisionsQuery.isError ? (
            <GovernanceQueryError retry={() => void revisionsQuery.refetch()} />
          ) : revisions.length ? (
            <Stack divider={<Divider flexItem />}>
              {revisions.map((revision) => (
                <Stack
                  key={revision.revisionId}
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  justifyContent="space-between"
                  gap={1.25}
                  sx={{ px: 1.5, py: 1.25 }}
                >
                  <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        flex: '0 0 auto',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'var(--dwp-product-soft)',
                        color: 'var(--dwp-product-accent)',
                      }}
                    >
                      <FileStack size={18} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" gap={0.7} alignItems="center" flexWrap="wrap">
                        <Typography fontWeight={800}>
                          {t('workplace.admin.governance.floorPlans.revisionNumber', {
                            number: revision.revisionNumber,
                          })}
                        </Typography>
                        <Chip
                          size="small"
                          color={revisionColor(revision.state)}
                          variant="outlined"
                          label={t(`workplace.admin.governance.revisionStates.${revision.state}`)}
                        />
                      </Stack>
                      <Typography variant="body2" noWrap>
                        {revision.changeSummary}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('workplace.admin.governance.floorPlans.placementCount', {
                          count: revision.placementCount,
                        })}{' '}
                        · {revision.planWidth} × {revision.planHeight} ·{' '}
                        {formatInstant(revision.publishedAt ?? revision.submittedAt)}
                      </Typography>
                    </Box>
                  </Stack>
                  {canManage ? (
                    <Stack direction="row" gap={0.75} flexWrap="wrap">
                      {revision.state === 'DRAFT' ? (
                        <ActionButton
                          intent="secondary"
                          startIcon={<Pencil size={15} />}
                          onClick={() =>
                            requestDraftExit({ type: 'EDIT', revisionId: revision.revisionId })
                          }
                        >
                          {t('workplace.admin.governance.floorPlans.editDraft')}
                        </ActionButton>
                      ) : null}
                      {workplaceGovernanceRevisionActions(revision).map((action) => (
                        <ActionButton
                          key={action}
                          intent={action === 'PUBLISH' ? 'primary' : 'secondary'}
                          startIcon={
                            action === 'REVIEW' ? (
                              <Send size={15} />
                            ) : action === 'PUBLISH' ? (
                              <CheckCheck size={15} />
                            ) : (
                              <ArchiveRestore size={15} />
                            )
                          }
                          onClick={() => requestDraftExit({ type: 'TRANSITION', revision, action })}
                        >
                          {t(`workplace.admin.governance.floorPlans.actions.${action}`)}
                        </ActionButton>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          ) : (
            <GovernanceEmpty
              title={t('workplace.admin.governance.floorPlans.emptyRevisions')}
              description={t('workplace.admin.governance.floorPlans.emptyRevisionsDescription')}
            />
          )}
        </GovernancePanel>

        <GovernancePanel
          title={t('workplace.admin.governance.floorPlans.published')}
          description={t('workplace.admin.governance.floorPlans.publishedDescription')}
        >
          {projectionQuery.isLoading ? <GovernanceLoading rows={3} /> : null}
          {projectionQuery.isError && hasPublishedRevision ? (
            <GovernanceQueryError retry={() => void projectionQuery.refetch()} />
          ) : null}
          {projectionQuery.data ? (
            <Stack spacing={1.25} sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  {t('workplace.admin.governance.floorPlans.revision')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  #{projectionQuery.data.revisionNumber}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  {t('workplace.admin.governance.floorPlans.canvas')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  {projectionQuery.data.planWidth} × {projectionQuery.data.planHeight}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  {t('workplace.admin.governance.floorPlans.placements')}
                </Typography>
                <Typography variant="body2" fontWeight={750}>
                  {projectionQuery.data.placements.length}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {formatInstant(projectionQuery.data.publishedAt)}
              </Typography>
            </Stack>
          ) : !projectionQuery.isLoading && !hasPublishedRevision ? (
            <GovernanceEmpty
              title={t('workplace.admin.governance.floorPlans.emptyPublished')}
              description={t('workplace.admin.governance.floorPlans.emptyPublishedDescription')}
            />
          ) : null}
        </GovernancePanel>
      </Box>

      {editingRevisionId ? (
        <GovernancePanel
          title={t('workplace.admin.governance.floorPlans.draftEditor')}
          description={t('workplace.admin.governance.floorPlans.draftEditorDescription')}
          actions={
            <ActionButton
              intent="quiet"
              startIcon={<X size={16} />}
              onClick={() => requestDraftExit({ type: 'CLOSE' })}
            >
              {t('workplace.admin.governance.floorPlans.closeEditor')}
            </ActionButton>
          }
        >
          {snapshotQuery.isLoading || resourcesQuery.isLoading || zonesQuery.isLoading ? (
            <GovernanceLoading rows={6} />
          ) : snapshotQuery.isError || resourcesQuery.isError || zonesQuery.isError ? (
            <GovernanceQueryError
              retry={() => {
                void snapshotQuery.refetch();
                void resourcesQuery.refetch();
                void zonesQuery.refetch();
              }}
            />
          ) : draftFloor && snapshot ? (
            <Box sx={{ p: 1.5 }}>
              {!zonesQuery.data?.length ? (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {t('workplace.admin.governance.floorPlans.zoneRequired')}
                </Alert>
              ) : null}
              <WorkplaceLayoutEditor
                key={`${snapshot.revision.revisionId}:${snapshot.revision.version}`}
                floor={draftFloor}
                resources={draftResources}
                availableResources={zonesQuery.data?.length ? (resourcesQuery.data ?? []) : []}
                editable={canManage && snapshot.revision.state === 'DRAFT'}
                showResourceEditActions={false}
                allowPlacementManagement
                blockNavigation={false}
                onEdit={() => undefined}
                onDirtyChange={handleDraftDirty}
                onSaveLayout={saveDraftLayout}
                onSaved={async () => {
                  await snapshotQuery.refetch();
                  await queryClient.invalidateQueries({
                    queryKey: ['workplace', 'governance', 'floor-plan-revisions', floorId],
                  });
                }}
                saveSuccessMessage={t('workplace.admin.governance.floorPlans.draftSaved')}
                saveErrorMessage={t('workplace.admin.governance.floorPlans.draftSaveError')}
              />
            </Box>
          ) : null}
        </GovernancePanel>
      ) : null}

      <FormDialog
        open={createOpen}
        title={t('workplace.admin.governance.floorPlans.createDraft')}
        description={t('workplace.admin.governance.floorPlans.createDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('workplace.admin.governance.floorPlans.create')}
        submittingLabel={t('actions.saving')}
        busy={createMutation.isPending}
        submitDisabled={!canManage || !changeSummary.trim()}
        onClose={() => setCreateOpen(false)}
        onSubmit={() => createMutation.mutate()}
      >
        <Stack spacing={2}>
          <SelectField
            label={t('workplace.admin.governance.floorPlans.basedOn')}
            value={basedOnRevisionId}
            options={[
              { value: '', label: t('workplace.admin.governance.floorPlans.currentProjection') },
              ...restorable.map((revision) => ({
                value: revision.revisionId,
                label: `#${revision.revisionNumber} · ${t(
                  `workplace.admin.governance.revisionStates.${revision.state}`
                )}`,
              })),
            ]}
            onValueChange={setBasedOnRevisionId}
          />
          <FormField
            required
            multiline
            minRows={3}
            label={t('workplace.admin.governance.floorPlans.changeSummary')}
            value={changeSummary}
            inputProps={{ maxLength: 500 }}
            onChange={(event) => setChangeSummary(event.target.value)}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(transition)}
        title={
          transition
            ? t(`workplace.admin.governance.floorPlans.transitionTitle.${transition.action}`)
            : ''
        }
        description={transition?.revision.changeSummary}
        cancelLabel={t('actions.cancel')}
        submitLabel={
          transition
            ? t(`workplace.admin.governance.floorPlans.actions.${transition.action}`)
            : t('actions.save')
        }
        submittingLabel={t('actions.saving')}
        submitIntent={transition?.action === 'PUBLISH' ? 'primary' : 'secondary'}
        busy={transitionMutation.isPending}
        submitDisabled={!canManage || !reason.trim()}
        onClose={() => setTransition(null)}
        onSubmit={() => {
          if (transition) transitionMutation.mutate(transition);
        }}
      >
        <Alert severity={transition?.action === 'PUBLISH' ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {transition
            ? t(`workplace.admin.governance.floorPlans.transitionNotice.${transition.action}`)
            : ''}
        </Alert>
        <FormField
          required
          multiline
          minRows={3}
          label={t('workplace.admin.governance.fields.reason')}
          value={reason}
          inputProps={{ maxLength: 500 }}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormDialog>

      <ConfirmDialog
        open={Boolean(pendingDraftExit)}
        title={t('workplace.admin.locations.unsavedTitle')}
        description={t('workplace.admin.locations.unsavedDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('workplace.admin.locations.discardChanges')}
        intent="danger"
        onClose={() => setPendingDraftExit(null)}
        onConfirm={() => {
          const intent = pendingDraftExit;
          setPendingDraftExit(null);
          if (intent) applyDraftExit(intent);
        }}
      />
    </Stack>
  );
}
