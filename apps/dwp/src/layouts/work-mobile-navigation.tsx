import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2, Ellipsis, Inbox, ListTodo, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ContentDialog } from '@dwp-frontend/design-system/components/dialogs/content-dialog';
import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { dwaionWorkspaceRoute } from '@dwp-frontend/shared-utils/dwaion-contract';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { WORK_NAVIGATION } from '../features/work/work-navigation';
import {
  workHubViewFromPath,
  workHubViewLocation,
} from '../features/work-hub/work-hub-view-navigation';

const primaryTabs = [
  { view: 'queue', icon: Inbox },
  { view: 'day-plan', icon: CalendarCheck2 },
  { view: 'action-required', icon: ListTodo },
] as const;

export function WorkMobileNavigation({ availableWidth }: { availableWidth?: number } = {}) {
  const { t } = useTranslation(['work', 'common']);
  const { permissions } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const mediaMobile = useMediaQuery('(max-width:899.95px)');
  const mobile = availableWidth === undefined ? mediaMobile : availableWidth < 900;
  const [moreOpen, setMoreOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const activeView = workHubViewFromPath(location.pathname);
  const secondaryTabs = WORK_NAVIGATION[0].items.slice(3);
  const moreSelected = secondaryTabs.some((item) => item.view === activeView);
  const canUseAssist = isAppReadEntitled('APP.ASK', permissions);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editing = document.activeElement?.matches(
        'textarea, input:not([type="checkbox"]):not([type="radio"]), [contenteditable="true"]'
      );
      setKeyboardOpen(Boolean(editing && viewport && window.innerHeight - viewport.height > 120));
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  if (!mobile) return null;
  const destination = (view: (typeof WORK_NAVIGATION)[0]['items'][number]['view']) =>
    workHubViewLocation(view, new URLSearchParams(location.search));
  const tabStyles = {
    minWidth: 0,
    minHeight: 60,
    px: 0.25,
    py: 0.75,
    gap: 0.5,
    flexDirection: 'column',
    color: 'text.secondary',
    borderRadius: 0,
    '& .MuiTypography-root': { maxWidth: '100%', overflowWrap: 'anywhere', textAlign: 'center' },
    '&[aria-current="page"]': { color: 'primary.main', bgcolor: 'action.selected' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -3 },
    '@media (forced-colors: active)': {
      '&[aria-current="page"]': { outline: '2px solid Highlight', outlineOffset: -2 },
    },
  } as const;

  return (
    <>
      <Box
        component="nav"
        data-testid="work-mobile-bottom-navigation"
        data-shell-auxiliary-layer="true"
        aria-label={t('work:workHub.mobileNavigation.label')}
        sx={{
          position: 'fixed',
          bottom: 0,
          insetInline: 0,
          display: keyboardOpen ? 'none' : 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom, 0px)',
          zIndex: (theme) => theme.zIndex.appBar + 1,
        }}
      >
        {primaryTabs.map(({ view, icon: Icon }) => (
          <ActionButton
            key={view}
            intent="quiet"
            aria-current={activeView === view ? 'page' : undefined}
            onClick={() => navigate(destination(view))}
            sx={tabStyles}
          >
            <Icon size={19} aria-hidden="true" />
            <Typography component="span" variant="caption">
              {t(`work:workHub.mobileNavigation.${view}`)}
            </Typography>
          </ActionButton>
        ))}
        <ActionButton
          intent="quiet"
          disabled={!canUseAssist}
          onClick={() => navigate(dwaionWorkspaceRoute())}
          sx={tabStyles}
        >
          <Sparkles size={19} aria-hidden="true" />
          <Typography component="span" variant="caption">
            {t('work:workHub.mobileNavigation.assist')}
          </Typography>
        </ActionButton>
        <ActionButton
          intent="quiet"
          aria-current={moreSelected ? 'page' : undefined}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
          sx={tabStyles}
        >
          <Ellipsis size={19} aria-hidden="true" />
          <Typography component="span" variant="caption">
            {t('work:workHub.mobileNavigation.more')}
          </Typography>
        </ActionButton>
      </Box>
      <ContentDialog
        open={moreOpen}
        title={t('work:workHub.mobileNavigation.moreTitle')}
        closeLabel={t('common:actions.close')}
        onClose={() => setMoreOpen(false)}
        maxWidth="xs"
        slotProps={{ paper: { sx: { alignSelf: 'flex-end', mb: 0, mx: 1, width: '100%' } } }}
      >
        <Stack gap={1} sx={{ pb: 'max(8px, env(safe-area-inset-bottom, 0px))' }}>
          {secondaryTabs.map(({ view, icon: Icon }) => (
            <ActionButton
              key={view}
              intent={activeView === view ? 'secondary' : 'quiet'}
              startIcon={<Icon size={20} aria-hidden="true" />}
              aria-current={activeView === view ? 'page' : undefined}
              onClick={() => {
                setMoreOpen(false);
                navigate(destination(view));
              }}
              sx={{ justifyContent: 'flex-start', minHeight: 48 }}
            >
              {t(`work:navigation.items.work.${view}.label`)}
            </ActionButton>
          ))}
        </Stack>
      </ContentDialog>
    </>
  );
}
