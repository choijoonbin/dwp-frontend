// ----------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { trackEvent, PermissionRouteGuard } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CodesTab } from './components/codes-tab';
import { CodeGroupsTab } from './components/code-groups-tab';

// ----------------------------------------------------------------------

export const CodesPage = () => (
  <PermissionRouteGuard resource="menu.admin.codes" permission="VIEW" redirectTo="/403">
    <CodesPageContent />
  </PermissionRouteGuard>
);

const CodesPageContent = () => {
  const [tabValue, setTabValue] = useState(0);

  // Track page view
  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.codes',
      action: 'VIEW',
      label: '코드 관리',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    trackEvent({
      resourceKey: 'menu.admin.codes',
      action: 'TAB_CHANGE',
      label: newValue === 0 ? '코드 그룹' : '코드',
      metadata: {
        tab: newValue,
      },
    });
  };

  return (
    <Box
      data-testid="page-admin-codes"
      sx={{
        p: 3,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        <Stack spacing={1}>
          <Typography variant="h4">코드 관리</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            시스템 코드 그룹 및 코드를 관리합니다. 변경 시 드롭다운·검증에 즉시 반영됩니다.
          </Typography>
        </Stack>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ minHeight: 48 }}>
            <Tab
              label="코드 그룹"
              icon={<Iconify icon="solar:layers-bold" width={18} />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
            <Tab
              label="코드"
              icon={<Iconify icon="solar:hashtag-square-bold" width={18} />}
              iconPosition="start"
              sx={{ minHeight: 48, textTransform: 'none' }}
            />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {tabValue === 0 && <CodeGroupsTab />}
          {tabValue === 1 && <CodesTab />}
        </Box>
      </Stack>
    </Box>
  );
};
