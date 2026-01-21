// ----------------------------------------------------------------------

import { memo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

// ----------------------------------------------------------------------

type PermissionValue = 'ALLOW' | 'DENY' | null;

type PermissionMatrixCellProps = {
  resourceKey: string;
  resourceName: string;
  permissionCode: string;
  permissionLabel: string;
  value: PermissionValue;
  isDirty: boolean;
  onClick: () => void;
};

export const PermissionMatrixCell = memo(
  ({ resourceKey, resourceName, permissionCode, permissionLabel, value, isDirty, onClick }: PermissionMatrixCellProps) => {
    const getTooltipText = () => {
      const status = value === 'ALLOW' ? '허용됨' : value === 'DENY' ? '거부됨' : '미설정';
      return `${resourceName} - ${permissionLabel}\n${status}\n클릭하여 변경`;
    };

    return (
      <Tooltip title={getTooltipText()} arrow placement="top">
        <Box
          component="button"
          onClick={onClick}
          sx={{
            position: 'relative',
            width: 80,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: 'action.hover',
            },
            '&:focus-visible': {
              outline: 2,
              outlineOffset: -2,
              outlineColor: 'primary.main',
            },
          }}
        >
          {value === 'ALLOW' && (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: 'success.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Iconify icon="solar:check-circle-bold" width={16} sx={{ color: 'success.main' }} />
            </Box>
          )}
          {value === 'DENY' && (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: 'error.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Iconify icon="solar:close-circle-bold" width={16} sx={{ color: 'error.main' }} />
            </Box>
          )}
          {!value && (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 2,
                borderStyle: 'dashed',
                borderColor: 'divider',
              }}
            />
          )}
          {isDirty && (
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'warning.main',
              }}
            />
          )}
        </Box>
      </Tooltip>
    );
  }
);

PermissionMatrixCell.displayName = 'PermissionMatrixCell';
