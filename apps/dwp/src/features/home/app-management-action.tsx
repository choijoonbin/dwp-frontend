import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import type { HomeAppDefinition } from '../../components/workspace-composer/app-launchpad-model';

export function AppManagementAction({
  app,
  variant,
  onManage,
}: {
  app: HomeAppDefinition;
  variant: 'overlay' | 'inline';
  onManage: (app: HomeAppDefinition) => void;
}) {
  const { t } = useTranslation('home');
  const label = t('launchpad.manageApp', { app: app.name });
  const activate = () => onManage(app);
  return (
    <Tooltip title={label}>
      {variant === 'inline' ? (
        <ActionIconButton label={label} onClick={activate}>
          <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />
        </ActionIconButton>
      ) : (
        <Box
          component="button"
          type="button"
          data-app-management-action
          aria-label={label}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            activate();
          }}
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-28px)',
            zIndex: 3,
            width: 24,
            height: 24,
            p: 0,
            display: 'grid',
            placeItems: 'center',
            border: 0,
            borderRadius: '50%',
            color: 'inherit',
            bgcolor: 'transparent',
            cursor: 'pointer',
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            },
          }}
        >
          <Box
            component="span"
            data-app-management-visual
            sx={{
              width: 20,
              height: 20,
              display: 'grid',
              placeItems: 'center',
              border: 1,
              borderColor: 'divider',
              borderRadius: '50%',
              color: 'primary.main',
              bgcolor: 'background.paper',
              boxShadow: 1,
            }}
          >
            <ShieldCheck size={12} strokeWidth={2} aria-hidden="true" />
          </Box>
        </Box>
      )}
    </Tooltip>
  );
}
