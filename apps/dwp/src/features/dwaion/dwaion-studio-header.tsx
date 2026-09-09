import { History, LockKeyhole, MessageSquarePlus, Share, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type DwaionStudioDetail = {
  conversationId: string | null;
  state?: 'COMPLETED' | 'ABSTAINED' | 'CONFIGURATION_REQUIRED';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  groundedFallback?: boolean;
};

export function DwaionStudioHeader({
  expert,
  onNew,
  detail,
}: {
  expert: boolean;
  onNew: () => void;
  detail?: DwaionStudioDetail;
}) {
  const { t } = useTranslation('work');
  const navigate = useNavigate();
  const auth = useAuth();
  const tenant = auth.user?.tenantName || auth.user?.tenantCode || t('shell.tenantFallback');
  const identity = auth.user?.displayName?.trim();
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
      // Clipboard access can be blocked by browser policy. The visible page remains usable.
    }
  };
  return (
    <Stack component="header" gap={{ xs: 0, md: 2 }}>
      <Box
        data-testid="dwaion-environment-strip"
        sx={{
          minHeight: { xs: 36, md: 32 },
          px: { xs: 1.25, md: 1.5 },
          py: 0.5,
          display: detail ? { xs: 'flex', md: 'none' } : 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: detail ? { xs: 'background.paper', md: 'action.selected' } : 'action.selected',
          color: 'text.secondary',
          borderBottom: detail ? { xs: 1, md: 0 } : 0,
          borderColor: 'divider',
        }}
      >
        {detail ? (
          <>
            <Typography
              variant="caption"
              noWrap
              sx={{ fontFamily: foundationTokens.font.mono, minWidth: 0 }}
            >
              {detail.conversationId
                ? `#${detail.conversationId}`
                : t('askPage.history.transcript')}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
              {detail.state && (
                <Chip
                  size="small"
                  color={
                    detail.state === 'COMPLETED' && !detail.groundedFallback ? 'success' : 'warning'
                  }
                  variant="outlined"
                  label={
                    detail.groundedFallback
                      ? t('askPage.fallback.state')
                      : t(`askPage.states.${detail.state}`)
                  }
                  sx={{
                    height: 22,
                    '& .MuiChip-label': { px: 0.8, fontSize: 'caption.fontSize' },
                  }}
                />
              )}
              {detail.confidence && (
                <Chip
                  size="small"
                  color="success"
                  label={t(`askPage.contextRail.confidence.${detail.confidence}`)}
                  sx={{
                    height: 22,
                    '& .MuiChip-label': { px: 0.8, fontSize: 'caption.fontSize' },
                  }}
                />
              )}
            </Stack>
          </>
        ) : (
          <>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  flex: '0 0 auto',
                }}
              />
              <Typography variant="caption" noWrap>
                {tenant}
              </Typography>
            </Stack>
            <Typography variant="caption" noWrap sx={{ textAlign: 'right' }}>
              {[identity, t('askPage.readOnly')].filter(Boolean).join(' · ')}
            </Typography>
          </>
        )}
      </Box>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        {detail ? (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="subtitle1" fontWeight="fontWeightBold" noWrap>
              {t('dwaionMobileHeader.product')}
            </Typography>
            <Typography color="text.disabled" aria-hidden="true">
              /
            </Typography>
            <Typography variant="body2" fontWeight="fontWeightMedium" noWrap>
              {t('dwaionMobileHeader.answerTitle')}
            </Typography>
            {detail.conversationId && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`#${detail.conversationId}`}
                sx={{
                  maxWidth: 240,
                  '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                }}
              />
            )}
            <Chip size="small" variant="outlined" label={tenant} />
          </Stack>
        ) : (
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              component="img"
              src="/assets/assistants/dwaion-link-v1.png"
              alt=""
              sx={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="primary.main">
                {t(expert ? 'askPage.approvalExpert.header.eyebrow' : 'askPage.header.eyebrow')}
              </Typography>
              <Typography component="h1" variant="h5">
                {t(expert ? 'askPage.approvalExpert.header.title' : 'askPage.header.title')}
              </Typography>
            </Box>
          </Stack>
        )}
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          {!detail && (
            <>
              <Chip
                size="small"
                variant="outlined"
                icon={<ShieldCheck size={14} />}
                label={t('askPage.permissionScoped')}
              />
              <Chip
                size="small"
                variant="outlined"
                icon={<LockKeyhole size={14} />}
                label={t('askPage.readOnly')}
              />
            </>
          )}
          {!expert &&
            (detail ? (
              <ActionButton
                intent="quiet"
                startIcon={<Share size={16} />}
                onClick={() => void shareConversation()}
              >
                {t('dwaionMobileHeader.share')}
              </ActionButton>
            ) : (
              <ActionButton
                intent="quiet"
                startIcon={<History size={16} />}
                onClick={() => navigate('/dwaion/conversations')}
              >
                {t('dwaionConversations.title')}
              </ActionButton>
            ))}
          <ActionButton
            intent="primary"
            startIcon={<MessageSquarePlus size={16} />}
            onClick={onNew}
          >
            {t('dwaionConversations.new')}
          </ActionButton>
        </Stack>
      </Box>
    </Stack>
  );
}
