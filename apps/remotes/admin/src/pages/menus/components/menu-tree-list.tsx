// ----------------------------------------------------------------------

import type { MouseEvent } from 'react';
import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

// ----------------------------------------------------------------------

type MenuTreeListProps = {
  tree: AdminMenuNode[];
  expandedNodes: Set<string>;
  selectedMenu: AdminMenuNode | null;
  onToggleNode: (nodeId: string) => void;
  onMenuOpen: (event: MouseEvent<HTMLElement>, menu: AdminMenuNode) => void;
  onMenuSelect: (menu: AdminMenuNode) => void;
  depth?: number;
};

export const MenuTreeList = memo(({
  tree,
  expandedNodes,
  selectedMenu,
  onToggleNode,
  onMenuOpen,
  onMenuSelect,
  depth = 0,
}: MenuTreeListProps) => (
  <Stack spacing={0.5}>
    {tree.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.id);
      const isSelected = selectedMenu?.id === node.id;
      const isFolder = !node.path;
      const isDisabled = node.enabled === false;

      return (
        <Box key={node.id}>
          <Box
            onClick={() => onMenuSelect(node)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              mx: 1,
              borderRadius: 1,
              cursor: 'pointer',
              minHeight: 44,
              color: isSelected ? 'primary.main' : 'text.primary',
              bgcolor: isSelected ? 'action.selected' : 'transparent',
              opacity: isDisabled ? 0.5 : 1,
              '&:hover': {
                bgcolor: isSelected ? 'action.selected' : 'action.hover',
              },
              '&:hover .menu-actions': {
                opacity: 1,
              },
              '@media (hover: none)': {
                '& .menu-actions': {
                  opacity: 1,
                },
              },
            }}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
          >
            {hasChildren ? (
              <IconButton
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleNode(node.id);
                }}
              >
                <Iconify icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'} width={16} />
              </IconButton>
            ) : (
              <Box sx={{ width: 28 }} />
            )}

            <Iconify
              icon={isFolder ? 'solar:folder-bold' : 'solar:document-text-bold'}
              width={18}
              sx={{ color: isFolder ? 'warning.main' : 'info.main' }}
            />

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                <Tooltip title={node.menuName}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {node.menuName}
                  </Typography>
                </Tooltip>
                {isDisabled && (
                  <Chip label="비활성" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                )}
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.25, minWidth: 0 }}>
                <Tooltip title={node.menuKey}>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
                  >
                    {node.menuKey}
                  </Typography>
                </Tooltip>
                {node.group && (
                  <Chip label={node.group} size="small" sx={{ height: 18, fontSize: 10 }} />
                )}
              </Stack>
            </Box>

            <Box className="menu-actions" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
              <IconButton
                onClick={(event) => {
                  event.stopPropagation();
                  onMenuOpen(event, node);
                }}
              >
                <Iconify icon="solar:menu-dots-bold" width={16} />
              </IconButton>
            </Box>
          </Box>
          {hasChildren && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ pt: 0.5 }}>
                <MenuTreeList
                  tree={node.children!}
                  expandedNodes={expandedNodes}
                  selectedMenu={selectedMenu}
                  onToggleNode={onToggleNode}
                  onMenuOpen={onMenuOpen}
                  onMenuSelect={onMenuSelect}
                  depth={depth + 1}
                />
              </Box>
            </Collapse>
          )}
        </Box>
      );
    })}
  </Stack>
));

MenuTreeList.displayName = 'MenuTreeList';
