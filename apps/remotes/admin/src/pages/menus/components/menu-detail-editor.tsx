// ----------------------------------------------------------------------

import type { AdminMenuNode } from '@dwp-frontend/shared-utils';

import { memo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';

import { MenuDetailForm } from './menu-detail-form';
import { MenuDetailFooter } from './menu-detail-footer';
import { MenuDetailHeader } from './menu-detail-header';
import { MenuDetailEmptyState } from './menu-detail-empty-state';

import type { MenuFormState } from '../types';

// ----------------------------------------------------------------------

type MenuDetailEditorProps = {
  menu: AdminMenuNode | null;
  menusTree: AdminMenuNode[];
  formData: MenuFormState;
  validationErrors: Record<string, string>;
  isLoading: boolean;
  onFormChange: <K extends keyof MenuFormState>(field: K, value: MenuFormState[K]) => void;
  onReset: () => void;
  onCreateChild: (menu: AdminMenuNode) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose?: () => void;
  variant?: 'default' | 'drawer';
};

export const MenuDetailEditor = memo(({
  menu,
  menusTree,
  formData,
  validationErrors,
  isLoading,
  onFormChange,
  onReset,
  onCreateChild,
  onSave,
  onDelete,
  onClose,
  variant = 'default',
}: MenuDetailEditorProps) => {
  if (!menu) {
    return <MenuDetailEmptyState />;
  }

  const isFolder = !formData.path;

  return (
    <Card
      sx={{
        width: 1,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: variant === 'drawer' ? 0 : 2,
      }}
    >
      <MenuDetailHeader menu={menu} enabled={formData.enabled} isFolder={isFolder} onClose={onClose} />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3 }}>
        <MenuDetailForm
          menu={menu}
          menusTree={menusTree}
          formData={formData}
          validationErrors={validationErrors}
          onFormChange={onFormChange}
          onCreateChild={onCreateChild}
          onDelete={onDelete}
        />
      </Box>
      <MenuDetailFooter isLoading={isLoading} onReset={onReset} onSave={onSave} />
    </Card>
  );
});

MenuDetailEditor.displayName = 'MenuDetailEditor';
