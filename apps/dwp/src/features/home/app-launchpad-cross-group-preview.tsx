import { useTranslation } from 'react-i18next';
import { foundationTokens } from '@dwp-frontend/design-system';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Folder } from 'lucide-react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { AppGlyph } from './app-glyph';
import { LAUNCHPAD_TILE_HEIGHT_CSS, LAUNCHPAD_TILE_WIDTH } from './app-launchpad-styles';

import type {
  HomeAppDefinition,
  HomeAppGroupId,
} from '../../components/workspace-composer/app-launchpad-model';

type AppLaunchpadCrossGroupPreviewProps = {
  itemId: string;
  groupId: HomeAppGroupId;
  label: string;
  app?: HomeAppDefinition;
  immersive: boolean;
};

/**
 * Destination-only footprint for a cross-group drag. The real sortable stays
 * mounted in its origin context so dnd-kit does not remount one active node
 * between SortableContexts while the pointer is down.
 */
export function AppLaunchpadCrossGroupPreview({
  itemId,
  groupId,
  label,
  app,
  immersive,
}: AppLaunchpadCrossGroupPreviewProps) {
  const { t } = useTranslation('home');

  return (
    <Box
      component="li"
      aria-hidden="true"
      data-launchpad-item={itemId}
      data-launchpad-group-id={groupId}
      data-launchpad-drop-preview="true"
      data-launchpad-reorder-indicator="true"
      sx={{
        position: 'relative',
        width: `var(--launchpad-tile-width, ${LAUNCHPAD_TILE_WIDTH}px)`,
        minWidth: `var(--launchpad-tile-width, ${LAUNCHPAD_TILE_WIDTH}px)`,
        height: LAUNCHPAD_TILE_HEIGHT_CSS,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        color: 'inherit',
        opacity: 0.68,
        pointerEvents: 'none',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 4,
          bottom: 18,
          left: -4,
          width: 4,
          borderRadius: foundationTokens.home.radius.surface,
          bgcolor: 'primary.main',
          boxShadow: (theme: Theme) => theme.shadows[2],
        },
        '@media (forced-colors: active)': {
          '&::before': { bgcolor: 'Highlight', boxShadow: 'none' },
        },
      }}
    >
      <Box
        data-launchpad-edit-frame
        sx={{
          width: 60,
          height: 60,
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          border: '1.5px dashed',
          borderColor: immersive ? foundationTokens.home.color.heroFocus : 'primary.main',
          borderRadius: foundationTokens.radius.control + 'px',
          bgcolor: immersive
            ? alpha(foundationTokens.home.color.heroFocus, 0.18)
            : 'action.selected',
          boxShadow: (theme: Theme) => theme.shadows[1],
        }}
      >
        {app ? (
          <Box data-launchpad-glyph sx={{ width: 52, height: 52 }}>
            <AppGlyph app={app} variant={immersive ? 'glass' : 'soft'} />
          </Box>
        ) : (
          <Folder size={28} aria-hidden="true" />
        )}
      </Box>
      <Typography
        component="span"
        variant="caption"
        fontWeight="fontWeightBold"
        sx={{ maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {label}
      </Typography>
      <Box
        component="span"
        data-launchpad-reorder-feedback
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: -4,
          zIndex: 1,
          minWidth: 'max-content',
          px: 0.75,
          py: 0.25,
          border: 1,
          borderColor: 'primary.main',
          borderRadius: foundationTokens.home.radius.surface,
          color: 'primary.main',
          bgcolor: 'background.paper',
          boxShadow: (theme: Theme) => theme.shadows[2],
          fontSize: foundationTokens.home.typography.compactSize,
          fontWeight: foundationTokens.home.typography.weightHeavy,
          lineHeight: foundationTokens.home.typography.tightLineHeight,
          whiteSpace: 'nowrap',
          transform: 'translateX(-50%)',
          '@media (forced-colors: active)': {
            color: 'Highlight',
            bgcolor: 'Canvas',
            borderColor: 'Highlight',
            boxShadow: 'none',
          },
        }}
      >
        {t('launchpad.drag.reorderReady')}
      </Box>
    </Box>
  );
}
