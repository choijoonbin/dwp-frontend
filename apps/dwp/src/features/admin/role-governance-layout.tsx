import { useTranslation } from 'react-i18next';
import { Info, Route } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';

export type RoleGovernanceView = 'roles' | 'assignments' | 'privileged' | 'effective';

const VIEWS: readonly RoleGovernanceView[] = ['roles', 'assignments', 'privileged', 'effective'];

export function RoleGovernanceLayout({
  view,
  onChange,
  children,
}: {
  view: RoleGovernanceView;
  onChange: (view: RoleGovernanceView) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('admin');
  return (
    <Box
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        gap={1.5}
        sx={{ px: 2, py: 1.75, bgcolor: 'action.hover' }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 34,
            height: 34,
            display: 'grid',
            flex: '0 0 34px',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'action.selected',
            borderRadius: 1,
          }}
        >
          <Route size={18} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{t('roleGovernance.guide.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('roleGovernance.guide.description')}
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={view}
        onChange={(_event, nextView: RoleGovernanceView) => onChange(nextView)}
        aria-label={t('roleGovernance.tabs.label')}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ px: 2, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        {VIEWS.map((item) => (
          <Tab
            key={item}
            id={`role-governance-tab-${item}`}
            aria-controls={`role-governance-panel-${item}`}
            value={item}
            label={t(`roleGovernance.tabs.${item}`)}
          />
        ))}
      </Tabs>

      <Stack direction="row" alignItems="flex-start" gap={1} sx={{ px: 2, py: 1.25 }}>
        <Info size={16} aria-hidden="true" />
        <Box>
          <Typography variant="subtitle2">{t(`roleGovernance.tabHelp.${view}.title`)}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`roleGovernance.tabHelp.${view}.description`)}
          </Typography>
        </Box>
      </Stack>

      <Box
        id={`role-governance-panel-${view}`}
        role="tabpanel"
        aria-labelledby={`role-governance-tab-${view}`}
      >
        {children}
      </Box>
    </Box>
  );
}
