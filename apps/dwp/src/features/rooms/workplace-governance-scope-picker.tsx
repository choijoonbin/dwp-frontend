import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  getWorkplaceAdminFloors,
  getWorkplaceAdminResources,
  getWorkplaceAdminSites,
  getWorkplaceGovernanceCampuses,
  getWorkplaceGovernanceZones,
  useAuth,
  usePermissionsStore,
} from '@dwp-frontend/shared-utils';
import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';
import type {
  WorkplaceGovernancePolicyScopeType,
  WorkplaceGovernanceDelegatedPermission,
} from '@dwp-frontend/shared-utils';
import { SelectField } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
const SCOPE_TYPES = ['TENANT', 'CAMPUS', 'SITE', 'FLOOR', 'ZONE', 'RESOURCE'] as const;
export function ScopePicker({
  scopeType,
  scopeId,
  disabled = false,
  allowedScopeTypes = SCOPE_TYPES,
  allowedSiteIds,
  targetPermission,
  onTargetChange,
  onChange,
}: {
  scopeType: WorkplaceGovernancePolicyScopeType;
  scopeId: string | null;
  disabled?: boolean;
  allowedScopeTypes?: readonly WorkplaceGovernancePolicyScopeType[];
  allowedSiteIds?: readonly string[];
  targetPermission?: WorkplaceGovernanceDelegatedPermission;
  onTargetChange?: (
    target: { siteId: string; floorId: string | null } | null,
    sourceReady: boolean
  ) => void;
  onChange: (scopeType: WorkplaceGovernancePolicyScopeType, scopeId: string | null) => void;
}) {
  const { t } = useTranslation('rooms');
  const { user } = useAuth();
  const governance = useWorkplaceGovernanceTargetScope();
  const permissions = usePermissionsStore((value) => value.permissions);
  const authorityKey = JSON.stringify([
    user,
    permissions,
    allowedScopeTypes,
    allowedSiteIds,
    targetPermission ? governance.authorityKey : null,
  ]);
  const [siteId, setSiteId] = useState('');
  const [floorId, setFloorId] = useState('');
  const campusesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'campuses', authorityKey],
    queryFn: getWorkplaceGovernanceCampuses,
    enabled: allowedScopeTypes.includes('CAMPUS'),
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const sitesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'sites', authorityKey],
    queryFn: getWorkplaceAdminSites,
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const sites = useMemo(
    () =>
      allowedSiteIds !== undefined
        ? (sitesQuery.isError ? [] : (sitesQuery.data ?? [])).filter((site) =>
            allowedSiteIds.includes(site.siteId)
          )
        : sitesQuery.isError
          ? []
          : (sitesQuery.data ?? []),
    [allowedSiteIds, sitesQuery.data, sitesQuery.isError]
  );
  useEffect(() => {
    if (scopeType === 'SITE' && sites.some((site) => site.siteId === scopeId)) setSiteId(scopeId!);
    else if (!sites.some((site) => site.siteId === siteId)) setSiteId(sites[0]?.siteId ?? '');
  }, [scopeId, scopeType, siteId, sites]);
  const floorsQuery = useQuery({
    queryKey: ['workplace', 'admin', 'floors', siteId, authorityKey],
    queryFn: () => getWorkplaceAdminFloors(siteId),
    enabled: Boolean(siteId && sites.some((site) => site.siteId === siteId)),
    staleTime: 30_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const floors = useMemo(() => {
    const returned = floorsQuery.isError ? [] : (floorsQuery.data ?? []);
    if (new Set(returned.map((floor) => floor.floorId)).size !== returned.length) return [];
    return returned.filter(
      (floor) =>
        floor.siteId === siteId &&
        (!targetPermission ||
          (governance.ready && governance.allowsTarget(targetPermission, siteId, floor.floorId)))
    );
  }, [floorsQuery.data, floorsQuery.isError, siteId, targetPermission, governance]);
  useEffect(() => {
    if (scopeType === 'FLOOR' && floors.some((floor) => floor.floorId === scopeId))
      setFloorId(scopeId!);
    else if (!floors.some((floor) => floor.floorId === floorId))
      setFloorId(floors[0]?.floorId ?? '');
  }, [scopeId, scopeType, floorId, floors]);
  const zonesQuery = useQuery({
    queryKey: ['workplace', 'governance', 'zones', floorId, authorityKey],
    queryFn: () => getWorkplaceGovernanceZones(floorId),
    enabled: Boolean(floorId && floors.some((floor) => floor.floorId === floorId)),
    staleTime: 20_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin', 'resources', floorId, authorityKey],
    queryFn: () => getWorkplaceAdminResources(floorId),
    enabled: Boolean(floorId && floors.some((floor) => floor.floorId === floorId)),
    staleTime: 20_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const zones = zonesQuery.isError ? [] : (zonesQuery.data ?? []);
  const resources = resourcesQuery.isError ? [] : (resourcesQuery.data ?? []);
  const canonicalZones =
    new Set(zones.map((zone) => zone.zoneId)).size === zones.length
      ? zones.filter((zone) => zone.floorId === floorId)
      : [];
  const canonicalResources =
    new Set(resources.map((resource) => resource.resourceId)).size === resources.length
      ? resources.filter((resource) => resource.siteId === siteId && resource.floorId === floorId)
      : [];
  const targetOptions = (() => {
    if (scopeType === 'CAMPUS') {
      return (campusesQuery.isError ? [] : (campusesQuery.data ?? [])).map((campus) => ({
        value: campus.campusId,
        label: `${campus.nameKo} (${campus.code})`,
      }));
    }
    if (scopeType === 'SITE') {
      return sites
        .filter(
          (site) =>
            !targetPermission ||
            (governance.ready && governance.allowsTarget(targetPermission, site.siteId))
        )
        .map((site) => ({ value: site.siteId, label: site.name }));
    }
    if (scopeType === 'FLOOR') {
      return floors.map((floor) => ({ value: floor.floorId, label: floor.name }));
    }
    if (scopeType === 'ZONE') {
      return canonicalZones.map((zone) => ({
        value: zone.zoneId,
        label: zone.nameKo,
      }));
    }
    if (scopeType === 'RESOURCE') {
      return canonicalResources.map((resource) => ({
        value: resource.resourceId,
        label: resource.name,
      }));
    }
    return [];
  })();
  useEffect(() => {
    if (disabled) return;
    if (scopeType === 'TENANT') {
      if (scopeId !== null) onChange(scopeType, null);
      return;
    }
    if (targetOptions.length && !targetOptions.some((option) => option.value === scopeId)) {
      onChange(scopeType, targetOptions[0].value);
    }
  }, [disabled, onChange, scopeId, scopeType, targetOptions]);

  const siteKnown =
    new Set(sites.map((site) => site.siteId)).size === sites.length &&
    sites.some((site) => site.siteId === siteId);
  const floorKnown = floors.some((floor) => floor.floorId === floorId && floor.siteId === siteId);
  const siteReady =
    siteKnown && sitesQuery.isSuccess && !sitesQuery.isFetching && !sitesQuery.isStale;
  const floorReady =
    siteReady &&
    floorKnown &&
    floorsQuery.isSuccess &&
    !floorsQuery.isFetching &&
    !floorsQuery.isStale;
  const target =
    scopeType === 'SITE' && sites.some((site) => site.siteId === scopeId)
      ? { siteId: scopeId!, floorId: null }
      : scopeType === 'FLOOR' && floors.some((floor) => floor.floorId === scopeId)
        ? { siteId, floorId: scopeId! }
        : (scopeType === 'ZONE' && canonicalZones.some((zone) => zone.zoneId === scopeId)) ||
            (scopeType === 'RESOURCE' &&
              canonicalResources.some((resource) => resource.resourceId === scopeId))
          ? { siteId, floorId }
          : null;
  const targetReady = targetPermission
    ? governance.ready &&
      (scopeType === 'TENANT'
        ? governance.globalAdministrator
        : scopeType === 'CAMPUS'
          ? governance.globalAdministrator &&
            campusesQuery.isSuccess &&
            !campusesQuery.isFetching &&
            !campusesQuery.isStale &&
            campusesQuery.data.some((campus) => campus.campusId === scopeId)
          : Boolean(target) &&
            governance.allowsTarget(targetPermission, target!.siteId, target!.floorId) &&
            (scopeType === 'SITE'
              ? new Set(sites.map((site) => site.siteId)).size === sites.length &&
                sitesQuery.isSuccess &&
                !sitesQuery.isFetching &&
                !sitesQuery.isStale
              : scopeType === 'FLOOR'
                ? siteReady &&
                  floorsQuery.isSuccess &&
                  !floorsQuery.isFetching &&
                  !floorsQuery.isStale
                : floorReady &&
                  (scopeType === 'ZONE'
                    ? zonesQuery.isSuccess && !zonesQuery.isFetching && !zonesQuery.isStale
                    : resourcesQuery.isSuccess &&
                      !resourcesQuery.isFetching &&
                      !resourcesQuery.isStale)))
    : false;
  const targetCallback = useRef(onTargetChange);
  targetCallback.current = onTargetChange;
  const targetKey = JSON.stringify([
    scopeType,
    scopeId,
    target,
    targetReady,
    governance.authorityKey,
  ]);
  const targetValue = useRef({ target, targetReady });
  targetValue.current = { target, targetReady };
  useEffect(() => {
    const value = targetValue.current;
    targetCallback.current?.(value.target, value.targetReady);
  }, [targetKey]);

  return (
    <Stack spacing={1.5}>
      <SelectField
        disabled={disabled}
        label={t('workplace.admin.governance.fields.scopeType')}
        value={scopeType}
        options={allowedScopeTypes.map((value) => ({
          value,
          label: t(`workplace.admin.governance.scopeTypes.${value}`),
        }))}
        onValueChange={(value) =>
          onChange(value as WorkplaceGovernancePolicyScopeType, value === 'TENANT' ? null : '')
        }
      />
      {['FLOOR', 'ZONE', 'RESOURCE'].includes(scopeType) ? (
        <SelectField
          disabled={disabled && !targetPermission}
          label={t('workplace.admin.governance.fields.site')}
          value={siteId}
          options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
          onValueChange={(value) => {
            setSiteId(value);
            setFloorId('');
            if (!disabled) onChange(scopeType, '');
          }}
        />
      ) : null}
      {['ZONE', 'RESOURCE'].includes(scopeType) ? (
        <SelectField
          disabled={disabled && !targetPermission}
          label={t('workplace.admin.governance.fields.floor')}
          value={floorId}
          options={floors.map((floor) => ({ value: floor.floorId, label: floor.name }))}
          onValueChange={(value) => {
            setFloorId(value);
            if (!disabled) onChange(scopeType, '');
          }}
        />
      ) : null}
      {scopeType !== 'TENANT' ? (
        <SelectField
          disabled={disabled}
          label={t('workplace.admin.governance.fields.scopeTarget')}
          value={scopeId ?? ''}
          options={targetOptions}
          onValueChange={(value) => onChange(scopeType, value)}
        />
      ) : null}
    </Stack>
  );
}
