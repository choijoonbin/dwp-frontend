import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Menu,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Share,
  SlidersHorizontal,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AccountMenu } from '../../components/account-menu';
import { NotificationMenu } from '../../components/shell-controls';
import {
  DWAION_ACTIVITY_FILTER_FOCUS_EVENT,
  DWAION_ACTIVITY_REFRESH_EVENT,
  DWAION_CONVERSATION_SEARCH_FOCUS_EVENT,
  type DwaionMobileHeaderProfile,
} from './dwaion-mobile-shell-profile';

export function DwaionMobileHeader({
  profile,
  navigation,
  onBack,
}: {
  profile: DwaionMobileHeaderProfile;
  navigation: {
    controlsId: string;
    expanded: boolean;
    label: string;
    testId: string;
    onOpen: (trigger: HTMLButtonElement) => void;
  };
  onBack: (path: string) => void;
}) {
  const { t } = useTranslation('work');
  const openFilters = () => globalThis.dispatchEvent(new Event(DWAION_ACTIVITY_FILTER_FOCUS_EVENT));
  const refreshActivity = () => globalThis.dispatchEvent(new Event(DWAION_ACTIVITY_REFRESH_EVENT));
  const focusConversationSearch = () =>
    globalThis.dispatchEvent(new Event(DWAION_CONVERSATION_SEARCH_FOCUS_EVENT));
  const shareConversation = async () => {
    const shareData = { title: document.title, url: globalThis.location.href };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard?.writeText(shareData.url);
    } catch {
      // Sharing can be blocked by browser policy; the conversation stays available.
    }
  };

  return (
    <Box
      component="header"
      data-testid="dwaion-header"
      data-dwp-shell="dwaion"
      sx={{
        position: 'fixed',
        inset: '0 0 auto 0',
        zIndex: (theme) => theme.zIndex.appBar,
        height: foundationTokens.layout.headerHeight,
        px: { xs: 1, sm: 1.5 },
        display: { xs: 'flex', lg: 'none' },
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        boxShadow: (theme) => theme.shadows[1],
        '& .MuiButtonBase-root': { minWidth: 44, minHeight: 44 },
      }}
    >
      {profile.kind === 'brand' ? (
        <>
          <ActionIconButton
            data-testid={navigation.testId}
            aria-controls={navigation.controlsId}
            aria-expanded={navigation.expanded}
            label={navigation.label}
            onClick={(event) => navigation.onOpen(event.currentTarget)}
          >
            <Menu size={22} aria-hidden="true" />
          </ActionIconButton>
          <Typography
            component="span"
            variant="h6"
            fontWeight="fontWeightBold"
            sx={{
              ml: 0.5,
              minWidth: 0,
              flex: '0 1 auto',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              letterSpacing: 'h6.letterSpacing',
            }}
          >
            {t('dwaionMobileHeader.company')}
          </Typography>
          <Typography
            component="span"
            variant="caption"
            fontWeight="fontWeightBold"
            sx={{
              px: 1,
              py: 0.45,
              borderRadius: foundationTokens.radius.surface * 4 + 'px',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              flexShrink: 0,
              letterSpacing: 'caption.letterSpacing',
            }}
          >
            {t('dwaionMobileHeader.product')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <NotificationMenu />
          <AccountMenu />
        </>
      ) : (
        <>
          <ActionIconButton
            label={t(profile.backLabelKey ?? 'dwaionMobileHeader.back')}
            onClick={() => onBack(profile.backPath)}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </ActionIconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {profile.titleLayout === 'inline-product' ? (
              <Stack direction="row" alignItems="baseline" gap={0.7} sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle2"
                  color="primary.main"
                  fontWeight="fontWeightBold"
                  noWrap
                >
                  {t('dwaionMobileHeader.product')}
                </Typography>
                <Typography variant="caption" color="text.disabled" aria-hidden="true">
                  |
                </Typography>
                <Typography variant="caption" fontWeight="fontWeightBold" noWrap>
                  {t(profile.titleKey)}
                </Typography>
              </Stack>
            ) : profile.titleLayout === 'plain' ? (
              <Typography
                component="span"
                variant="h6"
                fontWeight="fontWeightBold"
                noWrap
                display="block"
              >
                {t(profile.titleKey)}
              </Typography>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
                    {t('dwaionMobileHeader.product')}
                  </Typography>
                  {profile.screenCode && (
                    <Typography
                      variant="caption"
                      sx={{
                        px: 0.6,
                        borderRadius: foundationTokens.radius.compact + 'px',
                        bgcolor: 'var(--dwp-product-soft)',
                      }}
                    >
                      {profile.screenCode}
                    </Typography>
                  )}
                </Box>
                <Typography
                  component="span"
                  variant="subtitle2"
                  fontWeight="fontWeightBold"
                  noWrap
                  display="block"
                >
                  {t(profile.titleKey)}
                </Typography>
              </>
            )}
          </Box>
          {profile.actions.includes('filter') && (
            <ActionIconButton label={t('dwaionMobileHeader.filter')} onClick={openFilters}>
              <SlidersHorizontal size={18} aria-hidden="true" />
            </ActionIconButton>
          )}
          {profile.actions.includes('refresh') && (
            <ActionIconButton label={t('dwaionMobileHeader.refresh')} onClick={refreshActivity}>
              <RefreshCw size={18} aria-hidden="true" />
            </ActionIconButton>
          )}
          {profile.actions.includes('search') && (
            <ActionIconButton
              label={t('dwaionMobileHeader.search')}
              onClick={focusConversationSearch}
            >
              <Search size={20} aria-hidden="true" />
            </ActionIconButton>
          )}
          {profile.actions.includes('share') && (
            <ActionIconButton
              label={t('dwaionMobileHeader.share')}
              onClick={() => void shareConversation()}
            >
              <Share size={20} aria-hidden="true" />
            </ActionIconButton>
          )}
          {profile.actions.includes('new') && (
            <ActionButton
              size="small"
              intent="primary"
              startIcon={<MessageSquarePlus size={16} aria-hidden="true" />}
              onClick={() => onBack('/dwaion/new')}
              sx={{ minHeight: 44, px: 1.2, flex: '0 0 auto' }}
            >
              {t('dwaionMobileHeader.newQuestion')}
            </ActionButton>
          )}
          {profile.showNotifications && <NotificationMenu />}
          {profile.showAccount && <AccountMenu />}
        </>
      )}
    </Box>
  );
}
