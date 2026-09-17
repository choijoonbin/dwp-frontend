import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppLaunchpad } from '../app-launchpad';

import type {
  HomeAppDefinition,
  HomeAppGroup,
  LaunchpadLayout,
} from '../../../components/workspace-composer/app-launchpad-model';

type MzCompactLauncherProps = Readonly<{
  apps: readonly HomeAppDefinition[];
  groups: readonly HomeAppGroup[];
  layout: LaunchpadLayout;
  onBrowseAll: () => void;
  onLaunch: (app: HomeAppDefinition) => void;
}>;

export function MzCompactLauncher({
  apps,
  groups,
  layout,
  onBrowseAll,
  onLaunch,
}: MzCompactLauncherProps) {
  const { t } = useTranslation('home');
  return (
    <Box
      component="section"
      aria-labelledby="mz-compact-launcher-title"
      data-mz-compact-launcher
      data-mz-approved-app-count={apps.length}
      sx={{
        p: { xs: 1.25, sm: 1.5 },
        border: '1px solid rgba(255,255,255,0.22)',
        borderRadius: 3,
        bgcolor: 'rgba(8,25,61,0.82)',
        color: 'common.white',
        backdropFilter: 'blur(16px)',
        '@media (prefers-reduced-transparency: reduce)': {
          bgcolor: '#0B1F4A',
          backdropFilter: 'none',
        },
        '--flow-dock-text': '#FFFFFF',
        '--flow-dock-muted': 'rgba(255,255,255,0.74)',
        '--flow-dock-border': 'rgba(255,255,255,0.24)',
        '--flow-dock-hover': 'rgba(255,255,255,0.13)',
        '--flow-dock-active': 'rgba(255,255,255,0.19)',
        '--flow-dock-focus': '#FFFFFF',
        containerType: 'inline-size',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box minWidth={0}>
          <Typography id="mz-compact-launcher-title" variant="subtitle2" fontWeight={750}>
            {t('mz.launcher.title')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)' }}>
            {t('mz.launcher.description', { count: apps.length })}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          onClick={onBrowseAll}
          endIcon={<ArrowRight size={15} aria-hidden="true" />}
          sx={{ color: 'common.white', flexShrink: 0 }}
        >
          {t('mz.launcher.all')}
        </ActionButton>
      </Stack>
      <Box sx={{ mt: 1.25 }} data-mz-launcher-layout-version={layout.version}>
        <AppLaunchpad
          apps={apps}
          groups={groups}
          layout={layout}
          editing={false}
          reorderable={false}
          variant="flow"
          flowItemLimit={6}
          flowItemLimitPerGroup={2}
          onLaunch={onLaunch}
          onLayoutChange={() => undefined}
        />
      </Box>
    </Box>
  );
}
