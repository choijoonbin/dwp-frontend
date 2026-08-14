import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppWindow,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getAdminHomeExperience,
  getWorkspaceApps,
  updateHomeLaunchpadConfiguration,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { localizeHomeApps } from '../home/app-launchpad-model';
import { AdminPanelError, AdminPanelLoading } from './admin-ui';
import { useCurrentProviderSupportContext } from '../provider/use-provider-support-context';

import type {
  HomeLaunchpadConfiguration,
  HomeLaunchpadGroup,
  WorkspaceApp,
} from '@dwp-frontend/shared-utils';

type StudioLocale = 'ko' | 'en';
type CatalogApp = {
  resourceKey: string;
  name: string;
  description: string;
  defaultGroup: string;
};

function cloneConfiguration(configuration: HomeLaunchpadConfiguration): HomeLaunchpadConfiguration {
  return {
    schemaVersion: 1,
    groups: configuration.groups.map((group) => ({
      ...group,
      labels: { ...group.labels },
      descriptions: { ...group.descriptions },
    })),
    placements: configuration.placements.map((placement) => ({ ...placement })),
  };
}

function categoryGroup(app: WorkspaceApp): string {
  if (app.category === 'service' || app.category === 'people') return 'services';
  if (['knowledge', 'business', 'legacy'].includes(app.category)) return 'systems';
  return 'work';
}

function mergeCatalog(
  runtimeApps: WorkspaceApp[] | undefined,
  localizedStaticApps: ReturnType<typeof localizeHomeApps>
): CatalogApp[] {
  const staticByResource = new Map(localizedStaticApps.map((app) => [app.resourceKey, app]));
  const runtime = (runtimeApps ?? []).map((app) => ({
    resourceKey: app.resourceKey,
    name: app.name,
    description: app.description,
    defaultGroup: staticByResource.get(app.resourceKey)?.groupId ?? categoryGroup(app),
  }));
  const runtimeResources = new Set(runtime.map((app) => app.resourceKey));
  return [
    ...runtime,
    ...localizedStaticApps
      .filter((app) => !runtimeResources.has(app.resourceKey))
      .map((app) => ({
        resourceKey: app.resourceKey,
        name: app.name,
        description: app.description,
        defaultGroup: app.groupId,
      })),
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function withCatalogPlacements(
  configuration: HomeLaunchpadConfiguration,
  apps: CatalogApp[]
): HomeLaunchpadConfiguration {
  const next = cloneConfiguration(configuration);
  const enabledGroups = next.groups.filter((group) => group.enabled);
  const fallbackGroup = enabledGroups[0]?.groupKey ?? next.groups[0]?.groupKey ?? 'work';
  const placementByResource = new Map(
    next.placements.map((placement) => [placement.resourceKey, placement])
  );
  apps.forEach((app, index) => {
    if (placementByResource.has(app.resourceKey)) return;
    next.placements.push({
      resourceKey: app.resourceKey,
      groupKey: next.groups.some((group) => group.groupKey === app.defaultGroup && group.enabled)
        ? app.defaultGroup
        : fallbackGroup,
      sortOrder: (index + 1) * 10,
    });
  });
  return next;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function HomeAppLayoutManager() {
  const { t } = useTranslation('admin');
  const { t: homeT, i18n } = useTranslation('home');
  const toast = useToast();
  const queryClient = useQueryClient();
  const supportContext = useCurrentProviderSupportContext();
  const canWrite =
    !supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE');
  const [locale, setLocale] = useState<StudioLocale>('ko');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<HomeLaunchpadConfiguration | null>(null);

  const experienceQuery = useQuery({
    queryKey: ['admin', 'home-experience'],
    queryFn: getAdminHomeExperience,
  });
  const workspaceAppsQuery = useQuery({
    queryKey: ['workspace', 'apps'],
    queryFn: getWorkspaceApps,
    staleTime: 60_000,
    retry: 1,
  });
  const localizedStaticApps = useMemo(() => localizeHomeApps(homeT), [homeT]);
  const catalog = useMemo(
    () => mergeCatalog(workspaceAppsQuery.data, localizedStaticApps),
    [localizedStaticApps, workspaceAppsQuery.data]
  );

  useEffect(() => {
    const configuration = experienceQuery.data?.launchpadConfiguration;
    if (!configuration) return;
    const next = withCatalogPlacements(configuration, catalog);
    setDraft(next);
    setSelectedGroupKey((current) =>
      current && next.groups.some((group) => group.groupKey === current)
        ? current
        : (next.groups[0]?.groupKey ?? null)
    );
  }, [catalog, experienceQuery.data?.launchpadConfiguration]);

  const published = experienceQuery.data?.launchpadConfiguration;
  const changed = Boolean(
    draft &&
      published &&
      JSON.stringify(draft) !== JSON.stringify(withCatalogPlacements(published, catalog))
  );
  const groups = useMemo(
    () => [...(draft?.groups ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    [draft?.groups]
  );
  const selectedGroup = groups.find((group) => group.groupKey === selectedGroupKey);
  const placementByResource = useMemo(
    () => new Map((draft?.placements ?? []).map((placement) => [placement.resourceKey, placement])),
    [draft?.placements]
  );
  const visibleApps = catalog.filter((app) => {
    const normalized = query.trim().toLowerCase();
    return (
      !normalized ||
      app.name.toLowerCase().includes(normalized) ||
      app.description.toLowerCase().includes(normalized) ||
      app.resourceKey.toLowerCase().includes(normalized)
    );
  });

  const saveMutation = useMutation({
    mutationFn: () => updateHomeLaunchpadConfiguration(draft!, experienceQuery.data?.version ?? 0),
    onSuccess: async (next) => {
      queryClient.setQueryData(['admin', 'home-experience'], next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'home-experience', 'revisions'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
      ]);
      toast.success(t('homeApps.toasts.saved'));
    },
    onError: (error) => toast.error(errorMessage(error, t('homeApps.errors.save'))),
  });

  if (experienceQuery.isLoading || !draft) {
    return <AdminPanelLoading label={t('homeApps.loading')} />;
  }
  if (experienceQuery.isError) {
    return (
      <AdminPanelError message={errorMessage(experienceQuery.error, t('homeApps.errors.load'))} />
    );
  }

  const updateGroup = (groupKey: string, update: Partial<HomeLaunchpadGroup>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            groups: current.groups.map((group) =>
              group.groupKey === groupKey ? { ...group, ...update } : group
            ),
          }
        : current
    );
  };

  const updateLocalizedGroup = (
    groupKey: string,
    field: 'labels' | 'descriptions',
    value: string
  ) => {
    const group = draft.groups.find((candidate) => candidate.groupKey === groupKey);
    if (!group) return;
    updateGroup(groupKey, { [field]: { ...group[field], [locale]: value } });
  };

  const moveGroup = (groupKey: string, delta: -1 | 1) => {
    const index = groups.findIndex((group) => group.groupKey === groupKey);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= groups.length) return;
    const reordered = [...groups];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    setDraft((current) =>
      current
        ? {
            ...current,
            groups: reordered.map((group, groupIndex) => ({
              ...group,
              sortOrder: (groupIndex + 1) * 10,
            })),
          }
        : current
    );
  };

  const addGroup = () => {
    const groupKey = `custom-${Date.now().toString(36)}`;
    const next: HomeLaunchpadGroup = {
      groupKey,
      labels: { ko: t('homeApps.newGroup.ko'), en: t('homeApps.newGroup.en') },
      descriptions: {
        ko: t('homeApps.newGroup.descriptionKo'),
        en: t('homeApps.newGroup.descriptionEn'),
      },
      sortOrder: (groups.length + 1) * 10,
      enabled: true,
    };
    setDraft((current) => (current ? { ...current, groups: [...current.groups, next] } : current));
    setSelectedGroupKey(groupKey);
  };

  const removeGroup = (groupKey: string) => {
    if (groups.length <= 1) return;
    if (draft.placements.some((placement) => placement.groupKey === groupKey)) {
      toast.error(t('homeApps.errors.groupInUse'));
      return;
    }
    const nextGroups = draft.groups.filter((group) => group.groupKey !== groupKey);
    setDraft({ ...draft, groups: nextGroups });
    setSelectedGroupKey(nextGroups[0]?.groupKey ?? null);
  };

  const setGroupEnabled = (groupKey: string, enabled: boolean) => {
    if (!enabled && draft.placements.some((placement) => placement.groupKey === groupKey)) {
      toast.error(t('homeApps.errors.groupInUse'));
      return;
    }
    updateGroup(groupKey, { enabled });
  };

  const assignApp = (resourceKey: string, groupKey: string) => {
    setDraft((current) => {
      if (!current) return current;
      const groupPlacements = current.placements.filter(
        (placement) => placement.groupKey === groupKey
      );
      const nextOrder = Math.max(0, ...groupPlacements.map((item) => item.sortOrder)) + 10;
      const exists = current.placements.some((item) => item.resourceKey === resourceKey);
      return {
        ...current,
        placements: exists
          ? current.placements.map((item) =>
              item.resourceKey === resourceKey ? { ...item, groupKey, sortOrder: nextOrder } : item
            )
          : [...current.placements, { resourceKey, groupKey, sortOrder: nextOrder }],
      };
    });
  };

  const moveApp = (resourceKey: string, delta: -1 | 1) => {
    const placement = placementByResource.get(resourceKey);
    if (!placement) return;
    const siblings = draft.placements
      .filter((item) => item.groupKey === placement.groupKey)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const index = siblings.findIndex((item) => item.resourceKey === resourceKey);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target]!, siblings[index]!];
    const orderByResource = new Map(
      siblings.map((item, itemIndex) => [item.resourceKey, (itemIndex + 1) * 10])
    );
    setDraft({
      ...draft,
      placements: draft.placements.map((item) => ({
        ...item,
        sortOrder: orderByResource.get(item.resourceKey) ?? item.sortOrder,
      })),
    });
  };

  const groupName = (group: HomeLaunchpadGroup) =>
    group.labels[i18n.resolvedLanguage?.split('-')[0] ?? 'en'] ||
    group.labels.en ||
    group.labels.ko ||
    group.groupKey;

  return (
    <Stack gap={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {[
          [t('homeApps.metrics.groups'), groups.length, LayoutGrid],
          [t('homeApps.metrics.apps'), catalog.length, AppWindow],
          [
            t('homeApps.metrics.active'),
            groups.filter((group) => group.enabled).length,
            CheckCircle2,
          ],
          [t('homeApps.metrics.personal'), t('homeApps.metrics.personalValue'), UserRound],
        ].map(([label, value, Icon], index) => {
          const MetricIcon = Icon as typeof LayoutGrid;
          return (
            <Stack
              key={String(label)}
              direction="row"
              alignItems="center"
              gap={1.25}
              sx={{
                minWidth: 0,
                p: 2,
                borderRight: { lg: index < 3 ? 1 : 0 },
                borderBottom: { xs: index < 2 ? 1 : 0, lg: 0 },
                borderColor: 'divider',
              }}
            >
              <Box sx={{ color: 'primary.main', display: 'grid', placeItems: 'center' }}>
                <MetricIcon size={19} strokeWidth={1.8} />
              </Box>
              <Box minWidth={0}>
                <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {value as string | number}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label as string}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Box>

      <Alert icon={<ShieldCheck size={19} />} severity="info">
        <Typography variant="subtitle2">{t('homeApps.policy.title')}</Typography>
        <Typography variant="body2">{t('homeApps.policy.description')}</Typography>
      </Alert>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
        <Box>
          <Typography variant="h6">{t('homeApps.groups.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('homeApps.groups.description')}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <ActionButton
            intent="secondary"
            startIcon={<Plus size={16} />}
            disabled={!canWrite || groups.length >= 8}
            onClick={addGroup}
          >
            {t('homeApps.actions.addGroup')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            startIcon={<RotateCcw size={16} />}
            disabled={!changed || saveMutation.isPending}
            onClick={() => {
              setDraft(withCatalogPlacements(published!, catalog));
              setSelectedGroupKey(published?.groups[0]?.groupKey ?? null);
            }}
          >
            {t('homeApps.actions.revert')}
          </ActionButton>
          <ActionButton
            intent="primary"
            startIcon={<Save size={16} />}
            disabled={!canWrite || !changed || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {t('homeApps.actions.publish')}
          </ActionButton>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(240px, 0.65fr) minmax(0, 1.35fr)' },
          borderBlock: 1,
          borderColor: 'divider',
          minHeight: 360,
        }}
      >
        <Box sx={{ borderRight: { lg: 1 }, borderColor: 'divider', py: 1 }}>
          {groups.map((group, index) => {
            const count = draft.placements.filter(
              (placement) => placement.groupKey === group.groupKey
            ).length;
            const selected = group.groupKey === selectedGroupKey;
            return (
              <Box
                key={group.groupKey}
                sx={{
                  width: 1,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 1,
                  alignItems: 'center',
                  borderLeft: 3,
                  borderColor: selected ? 'primary.main' : 'transparent',
                  bgcolor: selected ? 'action.selected' : 'transparent',
                  color: 'text.primary',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedGroupKey(group.groupKey)}
                  sx={{
                    minWidth: 0,
                    p: 1.5,
                    border: 0,
                    bgcolor: 'transparent',
                    color: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Typography variant="subtitle2" noWrap>
                    {groupName(group)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('homeApps.groups.appCount', { count })}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ pr: 1 }}>
                  {!group.enabled && <Chip size="small" label={t('homeApps.groups.inactive')} />}
                  <ActionIconButton
                    size="small"
                    label={t('homeApps.actions.moveUp')}
                    disabled={index === 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveGroup(group.groupKey, -1);
                    }}
                  >
                    <ArrowUp size={15} />
                  </ActionIconButton>
                  <ActionIconButton
                    size="small"
                    label={t('homeApps.actions.moveDown')}
                    disabled={index === groups.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveGroup(group.groupKey, 1);
                    }}
                  >
                    <ArrowDown size={15} />
                  </ActionIconButton>
                </Stack>
              </Box>
            );
          })}
        </Box>

        {selectedGroup && (
          <Stack gap={2.5} sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
              <Box>
                <Typography variant="subtitle1">{t('homeApps.editor.title')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedGroup.groupKey}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="body2">{t('homeApps.editor.enabled')}</Typography>
                <Switch
                  checked={selectedGroup.enabled}
                  onChange={(_, checked) => setGroupEnabled(selectedGroup.groupKey, checked)}
                  inputProps={{ 'aria-label': t('homeApps.editor.enabled') }}
                />
                <ActionIconButton
                  size="small"
                  intent="danger"
                  label={t('homeApps.actions.deleteGroup')}
                  disabled={groups.length <= 1}
                  onClick={() => removeGroup(selectedGroup.groupKey)}
                >
                  <Trash2 size={16} />
                </ActionIconButton>
              </Stack>
            </Stack>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={locale}
              onChange={(_, value: StudioLocale | null) => value && setLocale(value)}
              aria-label={t('homeApps.editor.locale')}
            >
              <ToggleButton value="ko">{t('homeApps.editor.languages.ko')}</ToggleButton>
              <ToggleButton value="en">{t('homeApps.editor.languages.en')}</ToggleButton>
            </ToggleButtonGroup>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.5fr' }, gap: 2 }}
            >
              <FormField
                label={t('homeApps.editor.name')}
                required
                value={selectedGroup.labels[locale] ?? ''}
                onChange={(event) =>
                  updateLocalizedGroup(selectedGroup.groupKey, 'labels', event.target.value)
                }
              />
              <FormField
                label={t('homeApps.editor.description')}
                value={selectedGroup.descriptions[locale] ?? ''}
                onChange={(event) =>
                  updateLocalizedGroup(selectedGroup.groupKey, 'descriptions', event.target.value)
                }
              />
            </Box>
          </Stack>
        )}
      </Box>

      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
          gap={2}
        >
          <Box>
            <Typography variant="h6">{t('homeApps.placements.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('homeApps.placements.description')}
            </Typography>
          </Box>
          <FormField
            size="small"
            label={t('homeApps.placements.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ width: { xs: 1, sm: 320 } }}
          />
        </Stack>

        <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider' }}>
          {visibleApps.map((app) => {
            const placement = placementByResource.get(app.resourceKey);
            const siblings = draft.placements
              .filter((item) => item.groupKey === placement?.groupKey)
              .sort((left, right) => left.sortOrder - right.sortOrder);
            const placementIndex = siblings.findIndex(
              (item) => item.resourceKey === app.resourceKey
            );
            return (
              <Box
                key={app.resourceKey}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    md: 'minmax(220px, 1.4fr) minmax(210px, 0.8fr) auto',
                  },
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" alignItems="center" gap={1.25} minWidth={0}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 36,
                      height: 36,
                      flex: '0 0 36px',
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1,
                      color: 'primary.main',
                      bgcolor: 'action.selected',
                    }}
                  >
                    <AppWindow size={18} strokeWidth={1.8} />
                  </Box>
                  <Box minWidth={0}>
                    <Typography variant="subtitle2" noWrap>
                      {app.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {app.resourceKey}
                    </Typography>
                  </Box>
                </Stack>
                <SelectField
                  size="small"
                  label={t('homeApps.placements.group')}
                  value={placement?.groupKey ?? groups[0]?.groupKey ?? ''}
                  onValueChange={(value) => assignApp(app.resourceKey, String(value))}
                  options={groups
                    .filter((group) => group.enabled)
                    .map((group) => ({
                      value: group.groupKey,
                      label: groupName(group),
                    }))}
                />
                <Stack direction="row" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                  <ActionIconButton
                    size="small"
                    label={t('homeApps.actions.moveUp')}
                    disabled={placementIndex <= 0}
                    onClick={() => moveApp(app.resourceKey, -1)}
                  >
                    <ArrowUp size={16} />
                  </ActionIconButton>
                  <ActionIconButton
                    size="small"
                    label={t('homeApps.actions.moveDown')}
                    disabled={placementIndex < 0 || placementIndex === siblings.length - 1}
                    onClick={() => moveApp(app.resourceKey, 1)}
                  >
                    <ArrowDown size={16} />
                  </ActionIconButton>
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Divider />
      <Box>
        <Typography variant="h6">{t('homeApps.preview.title')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('homeApps.preview.description')}
        </Typography>
        <Box
          sx={{
            mt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          {groups
            .filter((group) => group.enabled)
            .map((group) => {
              const groupApps = catalog.filter(
                (app) => placementByResource.get(app.resourceKey)?.groupKey === group.groupKey
              );
              return (
                <Box
                  key={group.groupKey}
                  sx={{
                    minHeight: 156,
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="subtitle2">{groupName(group)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.descriptions[i18n.resolvedLanguage?.split('-')[0] ?? 'en'] ||
                      group.descriptions.en ||
                      group.descriptions.ko}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 2 }}>
                    {groupApps.slice(0, 8).map((app) => (
                      <Chip key={app.resourceKey} size="small" label={app.name} />
                    ))}
                    {groupApps.length > 8 && (
                      <Chip
                        size="small"
                        label={t('homeApps.preview.more', { count: groupApps.length - 8 })}
                      />
                    )}
                  </Stack>
                </Box>
              );
            })}
        </Box>
      </Box>
    </Stack>
  );
}
