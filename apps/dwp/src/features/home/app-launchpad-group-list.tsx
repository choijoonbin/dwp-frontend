import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';

import { groupTargetId } from './app-launchpad-dnd';
import {
  HOME_LAUNCHPAD_FIVE_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH,
  HOME_LAUNCHPAD_VISIBLE_COLUMNS,
  HOME_LAUNCHPAD_VISIBLE_ROWS,
} from '../../components/workspace-composer/home-launchpad-layout-contract';
import {
  LAUNCHPAD_TILE_HEIGHT,
  LAUNCHPAD_TILE_HEIGHT_CSS,
  LAUNCHPAD_TILE_WIDTH,
} from './app-launchpad-styles';

import type { HomeAppGroupId } from '../../components/workspace-composer/app-launchpad-model';

const VISIBLE_ROWS = 3;
const ROW_GAP = 2;
const GRID_TOP_INSET = 8;
const HOME_ROW_GAP = 8;
const GRID_HEIGHT =
  GRID_TOP_INSET + LAUNCHPAD_TILE_HEIGHT * VISIBLE_ROWS + ROW_GAP * (VISIBLE_ROWS - 1);
const HOME_GRID_HEIGHT =
  GRID_TOP_INSET +
  LAUNCHPAD_TILE_HEIGHT * HOME_LAUNCHPAD_VISIBLE_ROWS +
  HOME_ROW_GAP * (HOME_LAUNCHPAD_VISIBLE_ROWS - 1);

type AppLaunchpadGroupListProps = {
  groupId: HomeAppGroupId;
  groupName: string;
  itemIds: string[];
  sortableItemIds?: string[];
  immersive: boolean;
  dragDisabled: boolean;
  previewActive: boolean;
  flow: boolean;
  children: React.ReactNode;
};

export function AppLaunchpadGroupList({
  groupId,
  groupName,
  itemIds,
  sortableItemIds = itemIds,
  immersive,
  dragDisabled,
  previewActive,
  flow,
  children,
}: AppLaunchpadGroupListProps) {
  const dropTarget = useDroppable({
    id: groupTargetId(groupId),
    data: { groupId, type: 'group-target' },
    disabled: dragDisabled,
  });

  return (
    <SortableContext items={sortableItemIds} strategy={rectSortingStrategy}>
      <Box
        component="ul"
        ref={dropTarget.setNodeRef}
        data-launchpad-group-target={groupId}
        aria-label={groupName}
        sx={{
          '--launchpad-tile-width': flow ? '72px' : '100%',
          '--launchpad-label-height': flow ? '3em' : undefined,
          '--launchpad-label-line-height': flow
            ? (theme) => theme.typography.caption.lineHeight ?? 1.5
            : undefined,
          p: 0,
          pt: `${GRID_TOP_INSET}px`,
          mt: immersive ? 0.75 : flow ? 0 : { xs: 0.75, md: 0.5 },
          mb: 0,
          boxSizing: 'border-box',
          listStyle: 'none',
          display: 'grid',
          gridTemplateColumns: flow
            ? `repeat(auto-fill, ${LAUNCHPAD_TILE_WIDTH}px)`
            : immersive
              ? `repeat(${HOME_LAUNCHPAD_VISIBLE_COLUMNS}, minmax(0, 1fr))`
              : {
                  xs: 'repeat(4, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(5, minmax(0, 1fr))',
                },
          gridAutoRows: flow ? LAUNCHPAD_TILE_HEIGHT_CSS : `${LAUNCHPAD_TILE_HEIGHT}px`,
          justifyItems: immersive ? 'stretch' : 'center',
          justifyContent: flow ? 'start' : 'normal',
          columnGap: flow ? 0.75 : immersive ? 0 : { xs: 0.5, md: 1 },
          rowGap: immersive ? `${ROW_GAP}px` : `${HOME_ROW_GAP}px`,
          height: flow
            ? 'auto'
            : immersive
              ? `${GRID_HEIGHT}px`
              : { xs: 'auto', md: `${HOME_GRID_HEIGHT}px` },
          maxHeight: flow
            ? 'none'
            : immersive
              ? undefined
              : { xs: 'none', md: `${HOME_GRID_HEIGHT}px` },
          minHeight: flow
            ? LAUNCHPAD_TILE_HEIGHT_CSS
            : immersive
              ? undefined
              : { xs: LAUNCHPAD_TILE_HEIGHT, md: `${HOME_GRID_HEIGHT}px` },
          alignContent: 'start',
          overflowX: flow ? 'visible' : 'hidden',
          overflowY: flow ? 'visible' : immersive ? 'auto' : { xs: 'visible', md: 'auto' },
          overscrollBehaviorY: 'auto',
          scrollbarGutter: flow ? 'auto' : immersive ? 'stable' : { xs: 'auto', md: 'stable' },
          scrollbarWidth: 'thin',
          scrollbarColor: immersive ? 'rgba(255,255,255,0.38) transparent' : 'auto',
          outline:
            dropTarget.isOver || previewActive
              ? '2px solid rgba(141,184,255,0.88)'
              : '2px solid transparent',
          outlineOffset: -2,
          borderRadius: 0.75,
          backgroundColor:
            dropTarget.isOver || previewActive ? 'rgba(78,165,255,0.12)' : 'transparent',
          transition: (theme) =>
            theme.transitions.create(['background-color', 'outline-color'], {
              duration: theme.transitions.duration.shorter,
            }),
          '&::-webkit-scrollbar': immersive ? { width: 6 } : undefined,
          '&::-webkit-scrollbar-track': immersive ? { backgroundColor: 'transparent' } : undefined,
          '&::-webkit-scrollbar-thumb': immersive
            ? { borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.34)' }
            : undefined,
          '&::-webkit-scrollbar-thumb:hover': immersive
            ? { backgroundColor: 'rgba(255,255,255,0.52)' }
            : undefined,
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          '& [data-launchpad-edit-frame]': flow ? { width: 44, height: 44 } : undefined,
          '& [data-launchpad-glyph]': flow ? { scale: `${44 / 52}` } : undefined,
          '& [data-launchpad-remove-control]': flow ? { left: 'calc(50% - 34px)' } : undefined,
          '& [data-launchpad-item-label]': flow
            ? {
                fontSize: (theme) => theme.typography.caption.fontSize,
                overflowWrap: 'anywhere',
              }
            : undefined,
          [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH}px)`]: flow
            ? {
                '--launchpad-tile-width': '100%',
                gridTemplateColumns: `repeat(${HOME_LAUNCHPAD_VISIBLE_COLUMNS}, minmax(0, 1fr))`,
              }
            : undefined,
          [`@container flow-dock (min-width: ${HOME_LAUNCHPAD_FIVE_COLUMN_DOCK_MIN_WIDTH}px)`]: flow
            ? {
                gridTemplateColumns: `repeat(${HOME_LAUNCHPAD_VISIBLE_COLUMNS}, ${LAUNCHPAD_TILE_WIDTH}px)`,
              }
            : undefined,
        }}
      >
        {children}
      </Box>
    </SortableContext>
  );
}
