import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system';
import {
  getAdminHomeExperience,
  updateHomeCompositionPolicy,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  WORKSPACE_WIDGET_HEIGHT_POLICY,
  WORKSPACE_WIDGET_SIZE_POLICY,
} from '../../components/workspace-composer/workspace-widget-layout-policy';
import {
  WorkspaceWidgetFootprintGlyph,
  WorkspaceWidgetHeightGlyph,
} from '../../components/workspace-composer/workspace-widget-footprint-picker';
import {
  governedHomeZone,
  reconcileHomeCompositionPolicy,
} from '../../components/workspace-composer/home-composition-policy';
import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { useCurrentProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

import type {
  GovernedHomeZone,
  HomeCompositionPolicy,
  HomeGovernedZoneKey,
  HomeWidgetHeight,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';

const announcementSizes = ['compact', 'medium', 'large', 'full'] as const;
const announcementHeights = ['short', 'standard'] as const;

function clonePolicy(policy: HomeCompositionPolicy): HomeCompositionPolicy {
  return {
    ...policy,
    governedZones: policy.governedZones.map((zone) => ({ ...zone })),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function HomeCompositionManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const supportContext = useCurrentProviderSupportContext();
  const canWrite =
    !supportContext.data || supportContext.data.scopes.includes('TENANT_CONFIGURATION_WRITE');
  const [draft, setDraft] = useState<HomeCompositionPolicy | null>(null);
  const experienceQuery = useQuery({
    queryKey: ['admin', 'home-experience'],
    queryFn: getAdminHomeExperience,
  });
  const published = useMemo(
    () => reconcileHomeCompositionPolicy(experienceQuery.data?.compositionPolicy),
    [experienceQuery.data?.compositionPolicy]
  );

  useEffect(() => {
    setDraft(clonePolicy(published));
  }, [published]);

  const changed = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(published));
  const saveMutation = useMutation({
    mutationFn: () => updateHomeCompositionPolicy(draft!, experienceQuery.data?.version ?? 0),
    onSuccess: async (next) => {
      queryClient.setQueryData(['admin', 'home-experience'], next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home-experience'] }),
        queryClient.invalidateQueries({ queryKey: ['home-preference'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'home-experience', 'revisions'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
      ]);
      toast.success(t('homeComposition.toasts.saved'));
    },
    onError: (error) => toast.error(errorMessage(error, t('homeComposition.errors.save'))),
  });

  if (experienceQuery.isLoading || !draft) {
    return <ManagementPanelLoading label={t('homeComposition.loading')} />;
  }
  if (experienceQuery.isError) {
    return (
      <ManagementPanelError
        message={errorMessage(experienceQuery.error, t('homeComposition.errors.load'))}
      />
    );
  }

  const updateZone = (zoneKey: HomeGovernedZoneKey, update: Partial<GovernedHomeZone>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            governedZones: current.governedZones.map((zone) =>
              zone.zoneKey === zoneKey ? { ...zone, ...update } : zone
            ),
          }
        : current
    );
  };
  const announcements = governedHomeZone(draft, 'announcements');
  const announcementSpan = WORKSPACE_WIDGET_SIZE_POLICY[announcements.size].lg;
  const announcementHeight = WORKSPACE_WIDGET_HEIGHT_POLICY[announcements.height].blockSize;

  return (
    <Stack gap={3} component="section" aria-labelledby="home-composition-heading">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        gap={2}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography id="home-composition-heading" component="h2" variant="h5">
              {t('homeComposition.title')}
            </Typography>
            {changed && <Chip size="small" color="warning" label={t('homeComposition.unsaved')} />}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('homeComposition.description')}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <ActionButton
            intent="quiet"
            disabled={!changed || saveMutation.isPending}
            onClick={() => setDraft(clonePolicy(published))}
          >
            {t('homeComposition.actions.revert')}
          </ActionButton>
          <ActionButton
            intent="primary"
            startIcon={<Save size={16} />}
            disabled={!canWrite || !changed || saveMutation.isPending}
            loading={saveMutation.isPending}
            loadingLabel={t('homeComposition.actions.publish')}
            onClick={() => saveMutation.mutate()}
          >
            {t('homeComposition.actions.publish')}
          </ActionButton>
        </Stack>
      </Stack>

      <Alert icon={<ShieldCheck size={19} />} severity="info">
        <Typography variant="subtitle2">{t('homeComposition.policy.title')}</Typography>
        <Typography variant="body2">{t('homeComposition.policy.description')}</Typography>
      </Alert>

      <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={2}
          sx={{ py: 2.5 }}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.5}>
            <Box sx={{ color: 'primary.main', pt: 0.25 }}>
              <UserRound size={20} aria-hidden="true" />
            </Box>
            <Box>
              <Typography variant="subtitle1">{t('homeComposition.personal.title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('homeComposition.personal.description')}
              </Typography>
            </Box>
          </Stack>
          <Switch
            checked={draft.personalCustomizationEnabled}
            disabled={!canWrite}
            onChange={(_, checked) => setDraft({ ...draft, personalCustomizationEnabled: checked })}
            slotProps={{ input: { 'aria-label': t('homeComposition.personal.title') } }}
          />
        </Stack>
      </Box>

      <Box>
        <Typography variant="h6">{t('homeComposition.zones.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {t('homeComposition.zones.description')}
        </Typography>
        <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
          <GovernedZoneRow
            title={t('homeComposition.zones.announcements.title')}
            description={t('homeComposition.zones.announcements.description')}
            placement={t('homeComposition.placements.canvas')}
            visible={announcements.visible}
            disabled={!canWrite}
            onVisibilityChange={(visible) => updateZone('announcements', { visible })}
            control={
              <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={announcements.size}
                  disabled={!canWrite || !announcements.visible}
                  aria-label={t('homeComposition.zones.announcements.sizeLabel')}
                  onChange={(_, size: HomeWidgetSize | null) =>
                    size && updateZone('announcements', { size: size as GovernedHomeZone['size'] })
                  }
                >
                  {announcementSizes.map((size) => (
                    <Tooltip key={size} title={t(`homeComposition.sizes.${size}`)} arrow>
                      <ToggleButton value={size} aria-label={t(`homeComposition.sizes.${size}`)}>
                        <WorkspaceWidgetFootprintGlyph size={size} />
                      </ToggleButton>
                    </Tooltip>
                  ))}
                </ToggleButtonGroup>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={announcements.height}
                  disabled={!canWrite || !announcements.visible}
                  aria-label={t('homeComposition.zones.announcements.heightLabel')}
                  onChange={(_, height: HomeWidgetHeight | null) =>
                    height && updateZone('announcements', { height })
                  }
                >
                  {announcementHeights.map((height) => (
                    <Tooltip key={height} title={t(`homeComposition.heights.${height}`)} arrow>
                      <ToggleButton
                        value={height}
                        aria-label={t(`homeComposition.heights.${height}`)}
                      >
                        <WorkspaceWidgetHeightGlyph height={height} />
                      </ToggleButton>
                    </Tooltip>
                  ))}
                </ToggleButtonGroup>
              </Stack>
            }
          />
        </Box>
      </Box>

      <Box>
        <Typography variant="h6">{t('homeComposition.preview.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {t('homeComposition.preview.description')}
        </Typography>
        <Box
          sx={{
            mt: 2,
            p: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(60, minmax(0, 1fr))',
            gap: 1,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <PreviewZone
            columns={60}
            label={t('homeComposition.zones.workspaceTools.title')}
            policy="PERSONAL"
            policyLabel={t('homeComposition.policyKinds.personal')}
          />
          {announcements.visible && (
            <PreviewZone
              columns={announcementSpan}
              minHeight={Math.round(announcementHeight / 4)}
              label={t('homeComposition.zones.announcements.title')}
              policy="GOVERNED"
              policyLabel={t('homeComposition.policyKinds.governed')}
            />
          )}
          <PreviewZone
            columns={40}
            label={t('homeComposition.preview.commandRail')}
            policy="PERSONAL"
            policyLabel={t('homeComposition.policyKinds.personal')}
          />
        </Box>
      </Box>
    </Stack>
  );
}

function GovernedZoneRow({
  title,
  description,
  placement,
  visible,
  disabled,
  onVisibilityChange,
  control,
}: {
  title: string;
  description: string;
  placement: string;
  visible: boolean;
  disabled: boolean;
  onVisibilityChange: (visible: boolean) => void;
  control?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'stretch', md: 'center' }}
      justifyContent="space-between"
      gap={2}
      sx={{ py: 2.5 }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1.5}>
        <Box sx={{ color: 'text.secondary', pt: 0.25 }}>
          <LockKeyhole size={19} aria-hidden="true" />
        </Box>
        <Box>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="subtitle1">{title}</Typography>
            <Chip size="small" variant="outlined" label={placement} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={2}>
        {control}
        <Switch
          checked={visible}
          disabled={disabled}
          onChange={(_, checked) => onVisibilityChange(checked)}
          slotProps={{ input: { 'aria-label': title } }}
        />
      </Stack>
    </Stack>
  );
}

function PreviewZone({
  columns,
  minHeight = 64,
  label,
  policy,
  policyLabel,
}: {
  columns: number;
  minHeight?: number;
  label: string;
  policy: 'GOVERNED' | 'PERSONAL';
  policyLabel: string;
}) {
  const Icon = policy === 'GOVERNED' ? LockKeyhole : LayoutGrid;
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{
        gridColumn: `span ${columns}`,
        minWidth: 0,
        minHeight,
        px: 1.5,
        border: 1,
        borderColor: policy === 'GOVERNED' ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Icon size={17} aria-hidden="true" />
      <Box minWidth={0}>
        <Typography variant="subtitle2" noWrap>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {policyLabel}
        </Typography>
      </Box>
    </Stack>
  );
}
