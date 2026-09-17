import { useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { History, Search, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  getProviderWidgetRegistryReadiness,
  getWidgetVersionImpact,
  listWidgetAuditEvents,
  listWidgetCertificationEvidence,
  listWidgetDefinitionVersions,
  listWidgetDefinitions,
  resolveWidgetRegistryConnection,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { canRunWidgetRegistryTransition } from './widget-registry-governance-policy';

import type { WidgetDefinition, WidgetEvidence, WidgetVersion } from '@dwp-frontend/shared-utils';

const REQUIRED_EVIDENCE = [
  'MANIFEST',
  'SECURITY',
  'PRIVACY',
  'A11Y',
  'PERFORMANCE',
  'LOCALIZATION',
] as const;

export function hasCurrentWidgetCertificationEvidence(
  version: WidgetVersion | null | undefined,
  evidence: readonly WidgetEvidence[],
  now = new Date()
): boolean {
  if (!version || version.certificationStatus !== 'PASS') return false;
  if (version.workflowState !== 'APPROVED' || version.releaseState === 'UNPUBLISHED') return false;
  if (version.safetyState !== 'CLEAR') return false;
  return REQUIRED_EVIDENCE.every((evidenceType) =>
    evidence.some(
      (entry) =>
        entry.evidenceType === evidenceType &&
        entry.manifestHash === version.manifestHash &&
        (entry.status === 'PASS' ||
          (entry.status === 'WAIVED' &&
            (evidenceType === 'PERFORMANCE' || evidenceType === 'LOCALIZATION'))) &&
        (!entry.expiresAt || new Date(entry.expiresAt).getTime() > now.getTime())
    )
  );
}

function revealDetail(detailId: string, headingId: string) {
  if (!window.matchMedia('(max-width: 899.95px)').matches) return;
  window.requestAnimationFrame(() => {
    document.getElementById(headingId)?.focus({ preventScroll: true });
    document.getElementById(detailId)?.scrollIntoView({ block: 'start' });
  });
}

export function ProviderWidgetCatalog({
  onOpenCodeContracts,
}: {
  onOpenCodeContracts: () => void;
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const navigate = useNavigate();
  const detailId = useId();
  const headingId = `${detailId}-heading`;
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const [selectedId, setSelectedId] = useState('');
  const readinessQuery = useQuery({
    queryKey: ['widget-registry', 'readiness', 'provider'],
    queryFn: getProviderWidgetRegistryReadiness,
    staleTime: 30_000,
    retry: 1,
  });
  const connection = resolveWidgetRegistryConnection(readinessQuery.data);
  const definitionsQuery = useQuery({
    queryKey: ['widget-registry', 'provider-definitions'],
    queryFn: () => listWidgetDefinitions({ page: 0, size: 100 }),
    enabled: connection.reason === 'SHADOW',
    staleTime: 30_000,
    retry: 1,
  });
  const definitions = useMemo(
    () =>
      (definitionsQuery.data?.items ?? [])
        .filter((definition) => {
          if (!deferredQuery) return true;
          return `${definition.definitionKey} ${definition.ownerProductKey} ${definition.ownerTeamKey}`
            .toLocaleLowerCase()
            .includes(deferredQuery);
        })
        .sort((left, right) => left.definitionKey.localeCompare(right.definitionKey)),
    [definitionsQuery.data?.items, deferredQuery]
  );
  useEffect(() => {
    if (definitions.some((definition) => definition.definitionId === selectedId)) return;
    setSelectedId(definitions[0]?.definitionId ?? '');
  }, [definitions, selectedId]);
  const selected = definitions.find((definition) => definition.definitionId === selectedId) ?? null;

  if (readinessQuery.isLoading) {
    return <LoadingState label={t('widgetCatalog.controlPlane.loading')} variant="skeleton" />;
  }
  if (readinessQuery.isError || connection.reason !== 'SHADOW') {
    return (
      <ErrorState
        title={t('widgetCatalog.controlPlane.unavailable')}
        description={t('widgetCatalog.controlPlane.unavailableDescription')}
        retryLabel={t('widgetCatalog.controlPlane.retry')}
        retrying={readinessQuery.isFetching}
        onRetry={() => void readinessQuery.refetch()}
      />
    );
  }
  if (definitionsQuery.isLoading) {
    return (
      <LoadingState label={t('widgetCatalog.controlPlane.catalogLoading')} variant="skeleton" />
    );
  }
  if (definitionsQuery.isError) {
    return (
      <ErrorState
        title={t('widgetCatalog.controlPlane.catalogFailed')}
        description={t('widgetCatalog.controlPlane.catalogFailedDescription')}
        retryLabel={t('widgetCatalog.controlPlane.retry')}
        retrying={definitionsQuery.isFetching}
        onRetry={() => void definitionsQuery.refetch()}
      />
    );
  }

  const shadow = true;
  return (
    <Stack gap={2.5} data-widget-control-plane-mode={connection.reason.toLowerCase()}>
      <InlineFeedback
        severity={shadow ? 'warning' : 'info'}
        icon={<ShieldCheck size={19} />}
        title={t(
          shadow
            ? 'widgetCatalog.controlPlane.shadowTitle'
            : 'widgetCatalog.controlPlane.activeTitle'
        )}
      >
        <Typography variant="body2">
          {t(
            shadow
              ? 'widgetCatalog.controlPlane.shadowDescription'
              : 'widgetCatalog.controlPlane.activeDescription'
          )}
        </Typography>
      </InlineFeedback>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <FormField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          label={t('widgetCatalog.search.label')}
          placeholder={t('widgetCatalog.search.placeholder')}
          sx={{ maxWidth: { sm: 420 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <ActionButton intent="secondary" onClick={onOpenCodeContracts}>
            {t('widgetCatalog.actions.codeContract')}
          </ActionButton>
          <ActionButton intent="quiet" onClick={() => navigate('/provider/feature-rollouts')}>
            {t('widgetCatalog.actions.rollouts')}
          </ActionButton>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {t('widgetCatalog.controlPlane.resultCount', { count: definitions.length })}
      </Typography>
      {definitions.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title={t('widgetCatalog.search.empty')}
          description={t('widgetCatalog.search.emptyDescription')}
          size="standard"
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '340px minmax(0, 1fr)' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          <List
            disablePadding
            aria-label={t('widgetCatalog.listLabel')}
            sx={{ borderInlineEnd: { md: 1 }, borderColor: 'divider' }}
          >
            {definitions.map((definition) => (
              <ListItem key={definition.definitionId} disablePadding>
                <ListItemButton
                  selected={definition.definitionId === selected?.definitionId}
                  aria-label={definition.definitionKey}
                  aria-current={
                    definition.definitionId === selected?.definitionId ? 'true' : undefined
                  }
                  aria-controls={detailId}
                  onClick={() => {
                    setSelectedId(definition.definitionId);
                    revealDetail(detailId, headingId);
                  }}
                  sx={{ minHeight: 76, borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemText
                    primary={definition.definitionKey}
                    secondary={`${definition.ownerProductKey} · ${display(
                      'riskTiers',
                      definition.riskTier
                    )}`}
                    primaryTypographyProps={{ variant: 'subtitle2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(
                      `widgetCatalog.controlPlane.definitionState.${definition.definitionState}`
                    )}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {selected && (
            <ProviderWidgetDefinitionDetail
              detailId={detailId}
              headingId={headingId}
              definition={selected}
              shadow={shadow}
            />
          )}
        </Box>
      )}
    </Stack>
  );
}

function ProviderWidgetDefinitionDetail({
  detailId,
  headingId,
  definition,
  shadow,
}: {
  detailId: string;
  headingId: string;
  definition: WidgetDefinition;
  shadow: boolean;
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const versionsQuery = useQuery({
    queryKey: ['widget-registry', 'provider-versions', definition.definitionId],
    queryFn: () =>
      listWidgetDefinitionVersions(definition.definitionId, {
        page: 0,
        size: 20,
      }),
    retry: 1,
  });
  const selectedVersion = versionsQuery.data?.items[0] ?? null;
  const evidenceQuery = useQuery({
    queryKey: ['widget-registry', 'provider-evidence', selectedVersion?.versionId],
    queryFn: () =>
      listWidgetCertificationEvidence(selectedVersion!.versionId, {
        page: 0,
        size: 100,
      }),
    enabled: Boolean(selectedVersion),
    retry: 1,
  });
  const impactQuery = useQuery({
    queryKey: ['widget-registry', 'provider-impact', selectedVersion?.versionId, 'PUBLISH'],
    queryFn: () => getWidgetVersionImpact(selectedVersion!.versionId, 'PUBLISH'),
    enabled: Boolean(selectedVersion),
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ['widget-registry', 'provider-audit', definition.definitionId],
    queryFn: () => listWidgetAuditEvents({ page: 0, size: 100 }),
    retry: false,
  });
  const certified = hasCurrentWidgetCertificationEvidence(
    selectedVersion,
    evidenceQuery.data?.items ?? []
  );
  const auditEvents = (auditQuery.data?.items ?? []).filter((event) =>
    [definition.definitionId, selectedVersion?.versionId].includes(event.aggregateId)
  );
  const mutationReason = shadow
    ? t('widgetCatalog.controlPlane.shadowMutationDisabled')
    : undefined;
  return (
    <Stack
      id={detailId}
      role="region"
      aria-labelledby={headingId}
      gap={2.5}
      sx={{ p: 3, minWidth: 0 }}
    >
      <Box>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography id={headingId} component="h2" variant="h6" tabIndex={-1}>
            {definition.definitionKey}
          </Typography>
          <Chip
            size="small"
            color={certified ? 'success' : 'warning'}
            variant="outlined"
            label={t(
              certified
                ? 'widgetCatalog.controlPlane.certified'
                : 'widgetCatalog.controlPlane.evidenceIncomplete'
            )}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {definition.ownerTeamKey}
        </Typography>
      </Box>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        <Chip size="small" label={display('riskTiers', definition.riskTier)} />
        <Chip
          size="small"
          label={t(`dataGovernance.classification.${definition.dataClassification}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          label={definition.legacyWidgetKey ?? t('widgetCatalog.controlPlane.noLegacyKey')}
        />
      </Stack>
      <Divider />
      <Box>
        <Typography variant="subtitle2">{t('widgetCatalog.controlPlane.versionTitle')}</Typography>
        {selectedVersion ? (
          <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip size="small" label={selectedVersion.semanticVersion} />
            <Chip size="small" variant="outlined" label={selectedVersion.workflowState} />
            <Chip size="small" variant="outlined" label={selectedVersion.releaseState} />
            <Chip size="small" variant="outlined" label={selectedVersion.safetyState} />
            <Chip size="small" variant="outlined" label={selectedVersion.certificationStatus} />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {versionsQuery.isLoading
              ? t('widgetCatalog.controlPlane.versionLoading')
              : t('widgetCatalog.controlPlane.versionEmpty')}
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2">{t('widgetCatalog.controlPlane.evidenceTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('widgetCatalog.controlPlane.evidenceSummary', {
            passed: (evidenceQuery.data?.items ?? []).filter((entry) => entry.status === 'PASS')
              .length,
            required: REQUIRED_EVIDENCE.length,
          })}
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">{t('widgetCatalog.controlPlane.impactTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {impactQuery.data
            ? t('widgetCatalog.controlPlane.impactSummary', {
                tenants: impactQuery.data.affectedTenantCount,
                instances: impactQuery.data.instanceReferenceCount,
              })
            : shadow
              ? t('widgetCatalog.controlPlane.impactShadow')
              : t('widgetCatalog.controlPlane.impactUnavailable')}
        </Typography>
      </Box>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        {(['publish', 'block', 'deprecate', 'rollback'] as const).map((action) => {
          const transition = action.toUpperCase();
          return (
            <ActionButton
              key={action}
              size="small"
              intent={action === 'block' ? 'danger' : 'secondary'}
              disabled={
                !selectedVersion ||
                !canRunWidgetRegistryTransition({
                  shadow,
                  allowedTransitions: selectedVersion.allowedTransitions,
                  transition,
                  impact: impactQuery.data,
                })
              }
              title={mutationReason}
            >
              {t(`widgetCatalog.controlPlane.actions.${action}`)}
            </ActionButton>
          );
        })}
      </Stack>
      <Box>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <History size={16} aria-hidden="true" />
          <Typography variant="subtitle2">{t('widgetCatalog.controlPlane.auditTitle')}</Typography>
        </Stack>
        {auditEvents.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('widgetCatalog.controlPlane.auditEmpty')}
          </Typography>
        ) : (
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {auditEvents.map((event) => (
              <ListItem key={event.eventId} disableGutters>
                <ListItemText primary={event.eventType} secondary={event.occurredAt} />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Stack>
  );
}
