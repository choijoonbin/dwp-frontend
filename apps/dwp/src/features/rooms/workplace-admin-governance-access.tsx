import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Map, Pencil, Plus, ShieldCheck, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getWorkplaceAdminSites,
  getWorkplaceGovernanceAccessRules,
  previewWorkplaceGovernanceSiteAccess,
  useAuth,
  usePermissionsStore,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  SelectField,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  GovernanceEmpty,
  GovernanceLoading,
  GovernancePanel,
  GovernanceQueryError,
} from './workplace-admin-governance-ui';

import { verifiedAccessRuleFloors } from './workplace-governance-floor-scope';
import { AccessRuleEditor } from './workplace-governance-access-editor';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { useRoomsCapabilities } from './rooms-capabilities';
import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';

import type {
  WorkplaceGovernanceAccessPermission,
  WorkplaceGovernanceSiteAccessRule,
} from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

export function WorkplaceAdminGovernanceAccess({
  canManage,
  delegationSummary,
}: {
  canManage: boolean;
  delegationSummary?: ReactNode;
}) {
  const { t, i18n } = useTranslation('rooms');
  const navigate = useNavigate();
  const capabilities = useRoomsCapabilities();
  const governance = useWorkplaceGovernanceTargetScope();
  const { user } = useAuth();
  const permissions = usePermissionsStore((state) => state.permissions);
  const authorityKey = JSON.stringify([user, permissions, canManage, governance.authorityKey]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState('');
  const [permission, setPermission] = useState<WorkplaceGovernanceAccessPermission>('VIEW');
  const [editor, setEditor] = useState<WorkplaceGovernanceSiteAccessRule | 'new' | null>(null);
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'sites', authorityKey],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
  });
  const sites = useMemo(
    () => (governance.ready && !sitesQuery.isError ? (sitesQuery.data ?? []) : []),
    [sitesQuery.data, sitesQuery.isError, governance.ready]
  );
  const selectedSite = sites.find((site) => site.siteId === siteId) ?? sites[0] ?? null;
  useEffect(() => {
    if (selectedSite && selectedSite.siteId !== siteId) setSiteId(selectedSite.siteId);
  }, [selectedSite, siteId]);
  const rulesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'access-rules', selectedSite?.siteId, authorityKey],
    queryFn: () => getWorkplaceGovernanceAccessRules(selectedSite!.siteId),
    enabled: governance.ready && Boolean(selectedSite),
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
  });
  const previewQuery = useQuery({
    queryKey: [
      'workplace',
      'governance',
      'access-preview',
      selectedSite?.siteId,
      permission,
      authorityKey,
    ],
    queryFn: () => previewWorkplaceGovernanceSiteAccess(selectedSite!.siteId, permission),
    enabled: governance.ready && Boolean(selectedSite),
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
  });

  const visibleRules = useMemo(
    () =>
      governance.ready && selectedSite && !rulesQuery.isError
        ? (rulesQuery.data ?? []).filter(
            (rule) =>
              rule.siteId === selectedSite.siteId &&
              governance.allowsTarget('ACCESS_MANAGE', selectedSite.siteId, rule.floorId ?? null)
          )
        : [],
    [governance, selectedSite, rulesQuery.data, rulesQuery.isError]
  );
  const floorOptions =
    selectedSite && !previewQuery.isError
      ? verifiedAccessRuleFloors(selectedSite.siteId, previewQuery.data?.availableFloors)
      : null;
  const scopeLabel = (rule: WorkplaceGovernanceSiteAccessRule) =>
    rule.floorId
      ? (floorOptions?.find((floor) => floor.floorId === rule.floorId)?.name ?? rule.floorId)
      : t('workplace.experience.siteAccessInherited');
  const selectedRule = rulesQuery.isError
    ? null
    : (visibleRules.find((rule) => rule.accessRuleId === selectedRuleId) ?? null);
  const currentEditor =
    editor === 'new'
      ? editor
      : editor
        ? (visibleRules.find((rule) => rule.accessRuleId === editor.accessRuleId) ?? null)
        : null;
  const sourceReady =
    governance.ready &&
    !sitesQuery.isError &&
    !sitesQuery.isFetching &&
    !sitesQuery.isStale &&
    !rulesQuery.isError &&
    !rulesQuery.isFetching &&
    !rulesQuery.isStale;
  useEffect(() => {
    setEditor(null);
    setSelectedRuleId(null);
  }, [siteId, authorityKey]);

  useEffect(() => {
    if (!selectedRuleId && !editor && !rulesQuery.isError && visibleRules[0]) {
      setSelectedRuleId(visibleRules[0].accessRuleId);
    }
  }, [selectedRuleId, editor, visibleRules, rulesQuery.isError]);

  if (sitesQuery.isLoading) return <GovernanceLoading rows={6} />;
  if (sitesQuery.isError) return <GovernanceQueryError retry={() => void sitesQuery.refetch()} />;
  if (!selectedSite) {
    return (
      <GovernanceEmpty
        title={t('workplace.admin.governance.access.emptySites')}
        description={t('workplace.admin.governance.access.emptySitesDescription')}
      />
    );
  }

  const rulesPanel = (
    <GovernancePanel
      title={t('workplace.admin.governance.access.rules')}
      description={t('workplace.admin.governance.access.rulesDescription')}
      actions={
        canManage ? (
          <ActionButton
            intent="primary"
            startIcon={<Plus size={16} />}
            onClick={() => setEditor('new')}
          >
            {t('workplace.admin.governance.access.addRule')}
          </ActionButton>
        ) : null
      }
    >
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <SelectField
          label={t('workplace.admin.governance.fields.site')}
          value={selectedSite.siteId}
          options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
          onValueChange={setSiteId}
        />
      </Box>
      {rulesQuery.isLoading ? (
        <GovernanceLoading rows={4} />
      ) : rulesQuery.isError ? (
        <GovernanceQueryError retry={() => void rulesQuery.refetch()} />
      ) : visibleRules.length ? (
        <Stack divider={<Divider flexItem />}>
          {visibleRules.map((rule) => (
            <Stack
              key={rule.accessRuleId}
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              gap={1.25}
              sx={{
                px: 1.5,
                py: 1.25,
                borderLeft: 3,
                borderLeftColor: selectedRuleId === rule.accessRuleId ? 'info.main' : 'transparent',
                bgcolor:
                  selectedRuleId === rule.accessRuleId ? 'var(--dwp-product-soft)' : undefined,
              }}
            >
              <Stack direction="row" gap={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    flex: '0 0 auto',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: rule.effect === 'DENY' ? 'error.lighter' : 'success.lighter',
                    color: rule.effect === 'DENY' ? 'error.main' : 'success.main',
                  }}
                >
                  {rule.effect === 'DENY' ? <ShieldX size={17} /> : <ShieldCheck size={17} />}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {scopeLabel(rule)}
                  </Typography>
                  <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center">
                    <Typography fontWeight="fontWeightBold">
                      {rule.subjectType === 'USER'
                        ? t('workplace.admin.governance.access.userSubject', {
                            id: rule.subjectUserId,
                          })
                        : t('workplace.admin.governance.access.groupSubject', {
                            id: rule.subjectGroupRef,
                          })}
                    </Typography>
                    <Chip
                      size="small"
                      color={rule.effect === 'DENY' ? 'error' : 'success'}
                      variant="outlined"
                      label={t(`workplace.admin.governance.effects.${rule.effect}`)}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`workplace.admin.governance.permissions.${rule.permission}`)}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {rule.validFrom || rule.validUntil
                      ? t('workplace.admin.governance.access.validity', {
                          from: rule.validFrom ?? t('workplace.admin.governance.common.unbounded'),
                          until:
                            rule.validUntil ?? t('workplace.admin.governance.common.unbounded'),
                        })
                      : t('workplace.admin.governance.access.always')}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" gap={0.5}>
                <ActionButton
                  intent="quiet"
                  aria-pressed={selectedRuleId === rule.accessRuleId}
                  onClick={() => {
                    setSelectedRuleId(rule.accessRuleId);
                    setPermission(rule.permission);
                    setEditor(null);
                  }}
                >
                  {t('workplace.experience.inspectRule')}
                </ActionButton>
                {canManage &&
                sourceReady &&
                governance.allowsTarget(
                  'ACCESS_MANAGE',
                  selectedSite.siteId,
                  rule.floorId ?? null
                ) ? (
                  <ActionIconButton
                    size="small"
                    label={t('actions.edit')}
                    onClick={() => {
                      setSelectedRuleId(rule.accessRuleId);
                      setEditor(rule);
                    }}
                  >
                    <Pencil size={15} />
                  </ActionIconButton>
                ) : null}
              </Stack>
            </Stack>
          ))}
        </Stack>
      ) : (
        <GovernanceEmpty
          title={t('workplace.admin.governance.access.emptyRules')}
          description={t('workplace.admin.governance.access.emptyRulesDescription')}
        />
      )}
    </GovernancePanel>
  );
  const editorPanel = currentEditor ? (
    <AccessRuleEditor
      key={`${authorityKey}:${selectedSite.siteId}:${currentEditor === 'new' ? 'new' : currentEditor.accessRuleId}`}
      siteId={selectedSite.siteId}
      timeZone={selectedSite.timeZone}
      target={currentEditor}
      canManage={canManage}
      sourceReady={sourceReady}
      authorityKey={authorityKey}
      floorOptions={previewQuery.isError ? undefined : previewQuery.data?.availableFloors}
      floorSourceReady={
        !previewQuery.isError &&
        !previewQuery.isFetching &&
        !previewQuery.isStale &&
        floorOptions !== null
      }
      locale={i18n.resolvedLanguage}
      lead={rulesPanel}
      secondary={delegationSummary}
      recheck={async () => {
        const results = await Promise.all([
          sitesQuery.refetch(),
          rulesQuery.refetch(),
          previewQuery.refetch(),
        ]);
        return results.every((result) => result.isSuccess);
      }}
      onClose={() => setEditor(null)}
    />
  ) : null;

  return (
    <Stack spacing={2}>
      <InlineFeedback severity="info">
        {t('workplace.admin.governance.access.denyPrecedence')}
      </InlineFeedback>
      {editorPanel ?? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(300px, 0.8fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Stack spacing={2}>
            {rulesPanel}
            {delegationSummary}
          </Stack>

          <GovernancePanel
            title={t(
              currentEditor
                ? 'workplace.experience.changeAccessRule'
                : selectedRule
                  ? 'workplace.experience.selectedRule'
                  : 'workplace.admin.governance.access.preview'
            )}
            description={t('workplace.admin.governance.access.previewDescription')}
          >
            <Stack spacing={1.5} sx={{ p: 1.5 }}>
              {selectedRule ? (
                <Stack spacing={1}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {scopeLabel(selectedRule)}
                  </Typography>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {selectedRule.subjectType === 'USER'
                      ? t('workplace.admin.governance.access.userSubject', {
                          id: selectedRule.subjectUserId,
                        })
                      : t('workplace.admin.governance.access.groupSubject', {
                          id: selectedRule.subjectGroupRef,
                        })}
                  </Typography>
                  <Typography variant="body2">
                    {t(`workplace.admin.governance.permissions.${selectedRule.permission}`)} ·{' '}
                    {t(`workplace.admin.governance.effects.${selectedRule.effect}`)} ·{' '}
                    {t(`workplace.admin.governance.states.${selectedRule.state}`)}
                  </Typography>
                  <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                    {selectedRule.validFrom ?? t('workplace.admin.governance.common.unbounded')} →{' '}
                    {selectedRule.validUntil ?? t('workplace.admin.governance.common.unbounded')} ·{' '}
                    {t('workplace.experience.version')} {selectedRule.version}
                  </Typography>
                  {canManage ? (
                    <ActionButton
                      intent="secondary"
                      startIcon={<Pencil size={15} />}
                      onClick={() => setEditor(selectedRule)}
                    >
                      {t('actions.edit')}
                    </ActionButton>
                  ) : null}
                </Stack>
              ) : null}
              <Divider />
              <SelectField
                label={t('workplace.admin.governance.fields.permission')}
                value={permission}
                options={(['VIEW', 'BOOK', 'MANAGE'] as const).map((value) => ({
                  value,
                  label: t(`workplace.admin.governance.permissions.${value}`),
                }))}
                onValueChange={(value) =>
                  setPermission(value as WorkplaceGovernanceAccessPermission)
                }
              />
              {previewQuery.isLoading ? <GovernanceLoading rows={2} /> : null}
              {previewQuery.isError ? (
                <GovernanceQueryError retry={() => void previewQuery.refetch()} />
              ) : null}
              {previewQuery.data && !previewQuery.isError ? (
                <InlineFeedback
                  severity={previewQuery.data.allowed ? 'success' : 'warning'}
                  icon={previewQuery.data.allowed ? <ShieldCheck /> : <ShieldX />}
                >
                  <Typography fontWeight="fontWeightBold">
                    {t(
                      previewQuery.data.allowed
                        ? 'workplace.admin.governance.access.allowed'
                        : 'workplace.admin.governance.access.denied'
                    )}
                  </Typography>
                  <Typography variant="caption" component="div">
                    {previewQuery.data.decision} ·{' '}
                    {t('workplace.admin.governance.access.matchedRules', {
                      count: previewQuery.data.matchedRuleIds.length,
                    })}
                  </Typography>
                </InlineFeedback>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                {t('workplace.admin.governance.access.previewIdentityNotice')}
              </Typography>
            </Stack>
          </GovernancePanel>
        </Box>
      )}
      {capabilities.canViewWorkplaceAdmin ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="flex-end">
          <ActionButton
            intent="secondary"
            startIcon={<Map size={16} />}
            onClick={() => navigate(`/workplace/admin/locations?site=${selectedSite.siteId}`)}
          >
            {t('workplace.admin.locations.title')}
          </ActionButton>
          <ActionButton
            intent="secondary"
            startIcon={<History size={16} />}
            onClick={() => navigate('/workplace/admin/operations?view=audit')}
          >
            {t('workplace.experience.viewAudit')}
          </ActionButton>
        </Stack>
      ) : null}
    </Stack>
  );
}
