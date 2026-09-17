import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, RefreshCw, Settings2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  getAdminWorkplaceSafetyIncident,
  getAdminWorkplaceSafetyIncidents,
  getWorkplaceSafetyConnectors,
  usePermissions,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { RoomsPageHeading } from './rooms-ui';
import { WorkplaceMobileReservationInspector } from './workplace-mobile-reservation-inspector';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceSafetyActivation } from './workplace-safety-activation';
import { WorkplaceSafetyConnectors } from './workplace-safety-connectors';
import {
  WorkplaceSafetyAudienceEvidence,
  WorkplaceSafetyConnectorEvidence,
} from './workplace-safety-evidence';
import { WorkplaceSafetyIncidentActions } from './workplace-safety-incident-actions';
import { useWorkplaceSafetyOnlineState } from './workplace-safety-online';
import {
  latestWorkplaceSafetyDispatch,
  workplaceSafetyHasSourceRisk,
  workplaceSafetyIncidentTone,
  workplaceSafetyNeedsGetOnlyRecovery,
} from './workplace-safety-ui-model';

export function WorkplaceSafetyAdmin() {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const capabilities = useRoomsCapabilities();
  const permissions = usePermissions();
  const authority = useProductSurfaceAuthority();
  const queryClient = useQueryClient();
  const online = useWorkplaceSafetyOnlineState();
  const [params, setParams] = useSearchParams();
  const [showActivation, setShowActivation] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const selectedId = params.get('incident');
  const openerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const decisionRevision = authority.snapshot?.envelope.decisionRevision ?? '';
  const verifiedDecisionRevision = /^psr-[a-f0-9]{64}$/u.test(decisionRevision);

  const incidentsQuery = useQuery({
    queryKey: ['workplace', 'safety', 'admin', 'incidents'],
    queryFn: () => getAdminWorkplaceSafetyIncidents(),
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: false,
    refetchInterval: online ? 15_000 : false,
  });
  const connectorsQuery = useQuery({
    queryKey: ['workplace', 'safety', 'admin', 'connectors'],
    queryFn: getWorkplaceSafetyConnectors,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: false,
    refetchInterval: online ? 30_000 : false,
  });
  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);

  useEffect(() => {
    if (!selectedId || incidents.some((incident) => incident.incidentId === selectedId)) return;
    const next = new URLSearchParams(params);
    next.delete('incident');
    setParams(next, { replace: true });
  }, [incidents, params, selectedId, setParams]);

  const detailQuery = useQuery({
    queryKey: ['workplace', 'safety', 'admin', 'incident', selectedId],
    queryFn: () => getAdminWorkplaceSafetyIncident(selectedId!),
    enabled: Boolean(selectedId),
    initialData: incidents.find((incident) => incident.incidentId === selectedId),
    retry: false,
  });
  const selected = detailQuery.data ?? null;
  const canManage =
    capabilities.canManageWorkplaceAdmin && elevated && online && !connectorsQuery.isError;
  const canExport =
    permissions.isLoaded &&
    permissions.hasPermission('ADMIN.WORKPLACE', 'EXPORT') &&
    elevated &&
    verifiedDecisionRevision &&
    online;
  const active = incidents.filter(
    (incident) => incident.state === 'ACTIVE' || incident.state === 'CLOSURE_PENDING'
  );
  const needsHelp = active.reduce((total, incident) => total + incident.responses.needsHelp, 0);
  const deliveryFailed = active.reduce(
    (total, incident) =>
      total + incident.dispatches.reduce((count, dispatch) => count + dispatch.failedCount, 0),
    0
  );
  const unknownIncidents = active.filter((incident) =>
    workplaceSafetyNeedsGetOnlyRecovery(incident)
  ).length;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workplace', 'safety', 'admin', 'incidents'] }),
      queryClient.invalidateQueries({ queryKey: ['workplace', 'safety', 'admin', 'connectors'] }),
      selectedId ? detailQuery.refetch() : Promise.resolve(),
    ]);
  };
  const selectIncident = (incidentId: string, trigger: HTMLElement) => {
    openerRef.current = trigger;
    const next = new URLSearchParams(params);
    next.set('incident', incidentId);
    setParams(next, { replace: true });
  };
  const closeInspector = () => {
    const next = new URLSearchParams(params);
    next.delete('incident');
    setParams(next, { replace: true });
  };

  return (
    <PageCanvas topInset="compact" data-testid="workplace-safety-admin">
      <RoomsPageHeading
        eyebrow={t('workplace.safety.admin.eyebrow')}
        title={t('workplace.safety.admin.title')}
        description={t('workplace.safety.admin.description')}
        actions={
          <>
            <ActionButton
              intent="secondary"
              startIcon={<Settings2 size={16} />}
              onClick={() => setShowConnectors((value) => !value)}
            >
              {t('workplace.safety.actions.connectors')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Plus size={16} />}
              disabled={!canManage}
              onClick={() => setShowActivation((value) => !value)}
            >
              {t('workplace.safety.actions.newIncident')}
            </ActionButton>
            <ActionButton
              intent="secondary"
              startIcon={<RefreshCw size={16} />}
              loading={incidentsQuery.isFetching || connectorsQuery.isFetching}
              onClick={() => void refreshAll()}
            >
              {t('actions.refresh')}
            </ActionButton>
          </>
        }
      />

      {!capabilities.canManageWorkplaceAdmin && (
        <InlineFeedback severity="info" sx={{ mb: 1.5 }}>
          {t('workplace.safety.admin.readOnly')}
        </InlineFeedback>
      )}
      {capabilities.canManageWorkplaceAdmin && !elevated && (
        <InlineFeedback severity="warning" icon={<ShieldAlert size={18} />} sx={{ mb: 1.5 }}>
          {t('workplace.safety.admin.elevationRequired')}
        </InlineFeedback>
      )}
      {!online && (
        <InlineFeedback severity="error" icon={<AlertTriangle size={18} />} sx={{ mb: 1.5 }}>
          {t('workplace.safety.admin.offline')}
        </InlineFeedback>
      )}
      {connectorsQuery.isError && (
        <InlineFeedback severity="error" icon={<AlertTriangle size={18} />} sx={{ mb: 1.5 }}>
          {t('workplace.safety.connectors.loadError')}
        </InlineFeedback>
      )}

      {showActivation && (
        <Box sx={{ mb: 2 }}>
          <WorkplaceSafetyActivation
            canMutate={canManage}
            onActivated={async (result) => {
              setShowActivation(false);
              const next = new URLSearchParams(params);
              next.set('incident', result.incident.incidentId);
              setParams(next, { replace: true });
              await refreshAll();
            }}
          />
        </Box>
      )}
      {showConnectors && (
        <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 }, mb: 2 })}>
          {connectorsQuery.isLoading ? (
            <LoadingState embedded label={t('workplace.safety.loading')} />
          ) : connectorsQuery.data ? (
            <WorkplaceSafetyConnectors
              connectors={connectorsQuery.data}
              canManage={canManage}
              onChanged={refreshAll}
            />
          ) : (
            <InlineFeedback severity="error">
              {t('workplace.safety.connectors.loadError')}
            </InlineFeedback>
          )}
        </Box>
      )}

      <Box
        aria-label={t('workplace.safety.admin.summaryLabel')}
        sx={(theme) => ({
          ...workplaceMemberCard(theme),
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          mb: 2,
        })}
      >
        {[
          [t('workplace.safety.admin.activeIncidents'), active.length],
          [t('workplace.safety.admin.needsHelp'), needsHelp],
          [t('workplace.safety.admin.deliveryFailed'), deliveryFailed],
          [t('workplace.safety.admin.resultUnknown'), unknownIncidents],
        ].map(([label, value]) => (
          <Box
            key={String(label)}
            sx={{ p: 1.5, borderInlineEnd: 1, borderColor: 'divider', minWidth: 0 }}
          >
            <Typography variant="h5" fontWeight="fontWeightBold">
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography
        ref={headingRef}
        component="h2"
        variant="subtitle1"
        fontWeight="fontWeightBold"
        tabIndex={-1}
        sx={{ mb: 1 }}
      >
        {t('workplace.safety.admin.incidentTableTitle', { count: incidents.length })}
      </Typography>
      {incidentsQuery.isLoading ? (
        <LoadingState
          embedded
          variant="skeleton"
          skeletonRows={6}
          label={t('workplace.safety.loading')}
        />
      ) : incidentsQuery.isError ? (
        <InlineFeedback severity="error">{t('workplace.safety.admin.loadError')}</InlineFeedback>
      ) : incidents.length === 0 ? (
        <EmptyState
          title={t('workplace.safety.admin.emptyTitle')}
          description={t('workplace.safety.admin.emptyDescription')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: selectedId ? 'minmax(0, 1.25fr) minmax(380px, .75fr)' : 'minmax(0, 1fr)',
            },
            gap: 2,
          }}
        >
          <TableContainer sx={(theme) => ({ ...workplaceMemberCard(theme), overflowX: 'auto' })}>
            <Table size="small" aria-label={t('workplace.safety.admin.tableLabel')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('workplace.safety.admin.columns.incident')}</TableCell>
                  <TableCell>{t('workplace.safety.admin.columns.scope')}</TableCell>
                  <TableCell>{t('workplace.safety.admin.columns.responses')}</TableCell>
                  <TableCell>{t('workplace.safety.admin.columns.delivery')}</TableCell>
                  <TableCell align="right">{t('workplace.safety.admin.columns.action')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((incident) => {
                  const dispatch = latestWorkplaceSafetyDispatch(incident.dispatches);
                  return (
                    <TableRow
                      key={incident.incidentId}
                      selected={incident.incidentId === selectedId}
                    >
                      <TableCell>
                        <Stack gap={0.5} alignItems="flex-start">
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {incident.incidentNumber}
                          </Typography>
                          <Chip
                            size="small"
                            color={workplaceSafetyIncidentTone(incident)}
                            label={`${t(`workplace.safety.severities.${incident.severity}`)} · ${t(
                              `workplace.safety.incidentStates.${incident.state}`
                            )}`}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {t('workplace.safety.admin.scopeCounts', {
                            floors: incident.floorIds.length,
                            zones: incident.zoneIds.length,
                          })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('workplace.safety.asOf', {
                            value: formatDate(
                              incident.audience.asOf,
                              { dateStyle: 'short', timeStyle: 'short' },
                              locale
                            ),
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {t('workplace.safety.admin.responseCounts', {
                          safe: incident.responses.safe,
                          help: incident.responses.needsHelp,
                          none: incident.responses.noResponse,
                        })}
                      </TableCell>
                      <TableCell>
                        {dispatch
                          ? t('workplace.safety.dispatch.counts', {
                              delivered: dispatch.deliveredCount,
                              failed: dispatch.failedCount,
                              unknown: dispatch.unknownCount,
                            })
                          : t('workplace.safety.unknown')}
                      </TableCell>
                      <TableCell align="right">
                        <ActionButton
                          intent="quiet"
                          size="small"
                          onClick={(event) =>
                            selectIncident(incident.incidentId, event.currentTarget)
                          }
                        >
                          {t('workplace.safety.actions.inspect')}
                        </ActionButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {selectedId && (
            <WorkplaceMobileReservationInspector
              label={t('workplace.safety.admin.inspector')}
              closeLabel={t('actions.close')}
              fallbackFocusRef={headingRef}
              openerRef={openerRef}
              onClose={closeInspector}
            >
              <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                {detailQuery.isLoading ? (
                  <LoadingState embedded label={t('workplace.safety.loading')} />
                ) : detailQuery.isError || !selected ? (
                  <InlineFeedback severity="error">
                    {t('workplace.safety.admin.detailError')}
                  </InlineFeedback>
                ) : (
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          size="small"
                          color={workplaceSafetyIncidentTone(selected)}
                          label={t(`workplace.safety.incidentStates.${selected.state}`)}
                        />
                        <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                          {selected.incidentNumber}
                        </Typography>
                      </Stack>
                      <Typography sx={{ mt: 1 }}>{selected.message}</Typography>
                      <Box
                        sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25, mt: 1 })}
                      >
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {selected.safetyAction}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('workplace.safety.admin.selectedTarget', {
                            count: selected.audience.finalTargetCount,
                          })}
                        </Typography>
                      </Box>
                    </Box>
                    {workplaceSafetyHasSourceRisk(selected.audience.sources) && (
                      <InlineFeedback severity="warning" icon={<AlertTriangle size={18} />}>
                        {t('workplace.safety.audience.sourceRisk')}
                      </InlineFeedback>
                    )}
                    <WorkplaceSafetyAudienceEvidence audience={selected.audience} />
                    <WorkplaceSafetyConnectorEvidence connectors={selected.connectorTruth} />
                    <WorkplaceSafetyIncidentActions
                      key={selected.incidentId}
                      incident={selected}
                      canManage={canManage}
                      canExport={canExport}
                      decisionRevision={decisionRevision}
                      onChanged={refreshAll}
                    />
                  </Stack>
                )}
              </Box>
            </WorkplaceMobileReservationInspector>
          )}
        </Box>
      )}
    </PageCanvas>
  );
}
