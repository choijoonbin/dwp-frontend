import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getWorkplaceGovernanceDelegatedScopes,
  getWorkplaceGovernanceEffectiveDelegatedScopes,
  getWorkplaceAdminFloors,
  useAuth,
  usePermissionsStore,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ActionIconButton, InlineFeedback } from '@dwp-frontend/design-system';

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

import { DelegationDialog } from './workplace-governance-delegation-editor';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceDelegationFloorSet } from './workplace-delegation-floor-scope';
import { isWorkplaceGovernanceUuid } from './workplace-admin-governance-model';

import type { WorkplaceGovernanceDelegatedAdminScope } from '@dwp-frontend/shared-utils';

export function WorkplaceAdminGovernanceDelegation({
  canManage,
  canViewAssignments,
  compact = false,
}: {
  canManage: boolean;
  canViewAssignments: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation('rooms');
  const { user } = useAuth();
  const permissions = usePermissionsStore((state) => state.permissions);
  const authorityKey = JSON.stringify([user, permissions, canManage, canViewAssignments]);
  const [editor, setEditor] = useState<WorkplaceGovernanceDelegatedAdminScope | 'new' | null>(null);
  const scopesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'delegated-scopes', authorityKey],
    queryFn: getWorkplaceGovernanceDelegatedScopes,
    enabled: canViewAssignments,
    staleTime: 15_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
  });
  const effectiveQuery = useQuery({
    queryKey: ['workplace', 'governance', 'delegated-scopes', 'effective', authorityKey],
    queryFn: getWorkplaceGovernanceEffectiveDelegatedScopes,
    enabled: !compact,
    staleTime: 10_000,
    retry: retryRecoverableWorkplaceRead,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    setEditor(null);
  }, [authorityKey]);
  const currentEditor =
    scopesQuery.isError || !canViewAssignments
      ? null
      : editor === 'new'
        ? editor
        : editor
          ? (scopesQuery.data?.find((scope) => scope.delegationId === editor.delegationId) ?? null)
          : null;
  const sourceReady = !scopesQuery.isError && !scopesQuery.isFetching && !scopesQuery.isStale;

  return (
    <Stack spacing={2}>
      <InlineFeedback severity="info">
        {t('workplace.admin.governance.delegation.leastPrivilege')}
      </InlineFeedback>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            xl: canViewAssignments && !compact ? 'minmax(0, 1.5fr) minmax(320px, 0.7fr)' : '1fr',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {canViewAssignments ? (
          <GovernancePanel
            title={t('workplace.admin.governance.delegation.assignments')}
            description={t('workplace.admin.governance.delegation.assignmentsDescription')}
            actions={
              canManage ? (
                <ActionButton
                  intent="primary"
                  startIcon={<Plus size={16} />}
                  onClick={() => setEditor('new')}
                >
                  {t('workplace.admin.governance.delegation.add')}
                </ActionButton>
              ) : null
            }
          >
            {scopesQuery.isLoading ? (
              <GovernanceLoading rows={5} />
            ) : scopesQuery.isError ? (
              <GovernanceQueryError retry={() => void scopesQuery.refetch()} />
            ) : scopesQuery.data?.length ? (
              <Stack divider={<Divider flexItem />}>
                {scopesQuery.data.map((scope) => (
                  <Stack
                    key={scope.delegationId}
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    gap={1.25}
                    sx={{ px: 1.5, py: 1.25 }}
                  >
                    <Stack direction="row" gap={1.25} sx={{ minWidth: 0 }}>
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
                        <UserRoundCog size={18} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" gap={0.6} alignItems="center" flexWrap="wrap">
                          <Typography fontWeight="fontWeightBold">
                            {scope.delegateType === 'USER'
                              ? t('workplace.admin.governance.delegation.userDelegate', {
                                  id: scope.delegateUserId,
                                })
                              : t('workplace.admin.governance.delegation.groupDelegate', {
                                  id: scope.delegateGroupRef,
                                })}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={t(`workplace.admin.governance.states.${scope.state}`)}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {t(`workplace.admin.governance.delegatedScopeTypes.${scope.scopeType}`)} ·{' '}
                          {scope.siteId ?? scope.managedGroupRef}
                        </Typography>
                        {scope.scopeType === 'SITE' ? (
                          <DelegationFloorRange
                            siteId={scope.siteId}
                            floorIds={scope.floorIds}
                            authorityKey={authorityKey}
                          />
                        ) : null}
                        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.6 }}>
                          {scope.permissions.map((permission) => (
                            <Chip
                              key={permission}
                              size="small"
                              label={t(
                                `workplace.admin.governance.delegatedPermissions.${permission}`
                              )}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                    {canManage && scope.scopeType === 'SITE' ? (
                      <ActionIconButton
                        size="small"
                        label={t('actions.edit')}
                        onClick={() => setEditor(scope)}
                      >
                        <Pencil size={15} />
                      </ActionIconButton>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <GovernanceEmpty
                title={t('workplace.admin.governance.delegation.empty')}
                description={t('workplace.admin.governance.delegation.emptyDescription')}
              />
            )}
          </GovernancePanel>
        ) : null}

        {!compact ? (
          <GovernancePanel
            title={t('workplace.admin.governance.delegation.effective')}
            description={t('workplace.admin.governance.delegation.effectiveDescription')}
          >
            {effectiveQuery.isLoading ? <GovernanceLoading rows={3} /> : null}
            {effectiveQuery.isError ? (
              <GovernanceQueryError retry={() => void effectiveQuery.refetch()} />
            ) : null}
            {effectiveQuery.data?.length ? (
              <Stack divider={<Divider flexItem />}>
                {effectiveQuery.data.map((scope) => (
                  <Box key={scope.delegationId} sx={{ px: 1.5, py: 1.25 }}>
                    <Stack direction="row" gap={0.8} alignItems="center">
                      <ShieldCheck size={16} color="var(--dwp-product-accent)" />
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {t(`workplace.admin.governance.delegatedScopeTypes.${scope.scopeType}`)}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {scope.scopeId}
                    </Typography>
                    {scope.scopeType === 'SITE' ? (
                      <DelegationFloorRange
                        siteId={scope.scopeId}
                        floorIds={scope.floorIds}
                        authorityKey={authorityKey}
                      />
                    ) : null}
                    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                      {scope.permissions.map((permission) => (
                        <Chip
                          key={permission}
                          size="small"
                          variant="outlined"
                          label={t(`workplace.admin.governance.delegatedPermissions.${permission}`)}
                        />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : !effectiveQuery.isLoading && !effectiveQuery.isError ? (
              <GovernanceEmpty
                title={t('workplace.admin.governance.delegation.noEffective')}
                description={t('workplace.admin.governance.delegation.noEffectiveDescription')}
              />
            ) : null}
          </GovernancePanel>
        ) : null}
      </Box>

      {currentEditor ? (
        <DelegationDialog
          key={`${authorityKey}:${currentEditor === 'new' ? 'new' : currentEditor.delegationId}`}
          target={currentEditor}
          canManage={canManage}
          sourceReady={sourceReady}
          authorityKey={authorityKey}
          recheck={async () => {
            const result = await scopesQuery.refetch();
            return result.isSuccess;
          }}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </Stack>
  );
}

function DelegationFloorRange({
  siteId,
  floorIds,
  authorityKey,
}: {
  siteId: string | null;
  floorIds: string[] | null | undefined;
  authorityKey: string;
}) {
  const { t } = useTranslation('rooms');
  const floorSet = workplaceDelegationFloorSet(floorIds);
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'governance', 'delegation-floor-options', authorityKey, siteId],
    queryFn: () => getWorkplaceAdminFloors(siteId!),
    enabled:
      typeof siteId === 'string' && isWorkplaceGovernanceUuid(siteId) && Array.isArray(floorSet),
    staleTime: 30_000,
    refetchInterval: 15_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const source =
    floorsQuery.isSuccess && !floorsQuery.isError && Array.isArray(floorsQuery.data)
      ? floorsQuery.data
      : [];
  const floors = source.every(
    (floor) =>
      floor &&
      typeof floor.floorId === 'string' &&
      isWorkplaceGovernanceUuid(floor.floorId) &&
      floor.siteId === siteId
  )
    ? source
    : [];
  const names = Array.isArray(floorSet)
    ? floorSet.map((id) => floors.find((floor) => floor.floorId.toLowerCase() === id)?.name ?? id)
    : [];
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      component="div"
      sx={{ overflowWrap: 'anywhere' }}
    >
      {t('workplace.admin.governance.delegation.floorRange')}:{' '}
      {floorSet === false
        ? t('workplace.admin.governance.delegation.floorOptionsUnavailable')
        : floorSet === null
          ? t('workplace.admin.governance.delegation.allFloors')
          : names.join(', ')}
    </Typography>
  );
}
