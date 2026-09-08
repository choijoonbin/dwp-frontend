import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileClock, LockKeyhole, ShieldCheck } from 'lucide-react';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import Typography from '@mui/material/Typography';

import { AdminPanel, adminInset, adminPanel } from './meeting-admin-presentation';
import { useMeetingPolicyMobileSections } from './meeting-admin-policy-mobile-sections';

export function MeetingAdminPolicySection({
  title,
  forceOpen = false,
  defaultExpanded = true,
  mobileOnlySummary = false,
  number,
  children,
}: {
  title: string;
  forceOpen?: boolean;
  defaultExpanded?: boolean;
  mobileOnlySummary?: boolean;
  number?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [mobileOpen, setMobileOpen] = useState(defaultExpanded);
  const navigation = useMeetingPolicyMobileSections();
  const core = Boolean(navigation && number && ['01', '02', '03', '04'].includes(number));
  const expanded = core ? navigation?.selected === number : mobileOpen;
  const select = navigation?.select;
  useEffect(() => {
    if (!forceOpen) return;
    if (core && number) select?.(number);
    else setMobileOpen(true);
  }, [forceOpen, core, number, select]);
  return (
    <Box
      component="details"
      role="region"
      aria-label={title}
      id={number ? `meeting-policy-section-${number}` : undefined}
      open={!compact || expanded}
      onToggle={(event) => {
        if (compact && !core) setMobileOpen(event.currentTarget.open);
      }}
      sx={(currentTheme) => ({
        ...adminPanel(currentTheme),
        overflow: 'hidden',
        p: { xs: 1, md: 1.5 },
        ...(!compact && mobileOnlySummary
          ? { p: 0, border: 0, bgcolor: 'transparent', boxShadow: 'none' }
          : {}),
      })}
    >
      <Box
        component="summary"
        onClick={(event) => {
          if (!compact) event.preventDefault();
          else if (core) {
            event.preventDefault();
            navigation?.select(expanded ? null : (number ?? null));
          }
        }}
        sx={{
          display: { xs: 'flex', md: mobileOnlySummary ? 'none' : 'flex' },
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 0.5,
          py: 0.5,
          cursor: { xs: 'pointer', md: 'default' },
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <Stack direction="row" gap={1} alignItems="center">
          <Box
            component="span"
            sx={(currentTheme) => ({
              ...adminInset(currentTheme),
              color: 'primary.main',
              p: 0.75,
              fontSize: 'caption.fontSize',
              fontWeight: 'fontWeightBold',
            })}
          >
            {number ?? <ShieldCheck size={16} aria-hidden="true" />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box
              component="h2"
              sx={{ m: 0, typography: 'subtitle1', fontWeight: 'fontWeightBold' }}
            >
              {title}
            </Box>
            {compact && core && !expanded && number && (
              <Typography variant="caption" color="text.secondary">
                {navigation?.summaries[number as '01' | '02' | '03' | '04']}
              </Typography>
            )}
          </Box>
        </Stack>
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            flex: '0 0 auto',
            transform: expanded ? 'rotate(180deg)' : undefined,
          }}
        >
          <ChevronDown size={18} />
        </Box>
      </Box>
      {children}
    </Box>
  );
}

export function MeetingAdminPolicyImpact({
  version,
  changedCount,
}: {
  version: number;
  changedCount: number;
}) {
  const { t } = useTranslation('meetings');
  return (
    <Box
      component="aside"
      aria-label={t('admin.policy.impactTitle')}
      sx={(theme) => ({
        ...adminPanel(theme),
        gridArea: 'impact',
        p: { xs: 1.5, md: 2.5 },
      })}
    >
      <Box component="h2" sx={{ m: 0, typography: 'subtitle1' }}>
        {t('admin.policy.impactTitle')}
      </Box>
      <Box component="p" sx={{ m: 0, color: 'text.secondary', typography: 'caption' }}>
        {t('admin.policy.version', { version })}
      </Box>
      <Box
        component="p"
        sx={(theme) => ({ ...adminInset(theme), m: 0, mt: 1.5, p: 1.5, typography: 'body2' })}
      >
        {changedCount > 0
          ? t('admin.policy.impactChanged', { count: changedCount })
          : t('admin.policy.impactUnchanged')}
      </Box>
      <Box component="p" sx={{ m: 0, mt: 1, color: 'text.secondary', typography: 'caption' }}>
        {t('admin.policy.impactBoundary')}
      </Box>
    </Box>
  );
}

export function MeetingAdminPolicyBoundaries({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('meetings');
  return (
    <MeetingAdminPolicySection
      title={t('admin.policy.boundariesTitle')}
      defaultExpanded={false}
      mobileOnlySummary
    >
      <Stack gap={2} sx={{ gridArea: 'boundaries' }}>
        {!canManage && (
          <InlineFeedback severity="warning">{t('admin.policy.readOnly')}</InlineFeedback>
        )}
        <AdminPanel title={t('admin.design.overridesTitle')} icon={ShieldCheck}>
          <Typography variant="body2" color="text.secondary">
            {t('admin.policy.overrideUnavailable')}
          </Typography>
          <Typography
            variant="caption"
            display="block"
            sx={(theme) => ({ ...adminInset(theme), mt: 1.5, p: 1.5 })}
          >
            {t('admin.design.sourceConnection')}
          </Typography>
        </AdminPanel>
        <AdminPanel title={t('admin.design.auditTitle')} icon={FileClock}>
          <Typography variant="body2" color="text.secondary">
            {t('admin.policy.auditUnavailable')}
          </Typography>
          <Box component="ol" sx={{ pl: 2.5, mb: 0, color: 'text.secondary' }}>
            <Typography component="li" variant="caption">
              {t('admin.design.auditConnection')}
            </Typography>
          </Box>
        </AdminPanel>
        <AdminPanel title={t('admin.design.enforcementTitle')} icon={LockKeyhole}>
          <Typography variant="body2" color="text.secondary">
            {t('admin.policy.unmuteRequestOnly')}
          </Typography>
        </AdminPanel>
      </Stack>
    </MeetingAdminPolicySection>
  );
}

export function MeetingAdminPolicyContext({ version }: { version: number }) {
  const { t } = useTranslation('meetings');
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} gap={2} sx={{ mb: 2.5 }}>
      <Box sx={(theme) => ({ ...adminInset(theme), p: 2, flex: 1 })}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ShieldCheck size={19} aria-hidden="true" />
          <Typography variant="subtitle2" fontWeight="fontWeightBold">
            {t('admin.design.tenantScope')}
          </Typography>
        </Stack>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          {t('admin.policy.version', { version })}
        </Typography>
        <Box
          component="details"
          sx={{
            mt: 0.5,
            '& > summary': {
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              listStyle: 'none',
              '&::-webkit-details-marker': { display: 'none' },
              '&:focus-visible': { outline: 2, outlineColor: 'primary.main' },
            },
          }}
        >
          <Box component="summary">
            <Typography component="span" variant="caption" fontWeight="fontWeightMedium">
              {t('admin.design.policyConnectionDetails')}
            </Typography>
            <ChevronDown size={15} aria-hidden="true" />
          </Box>
          <Stack gap={1}>
            <Typography variant="body2">{t('admin.policy.impactBoundary')}</Typography>
            <Typography variant="body2">{t('admin.design.policyAuthorityDescription')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('admin.design.policyControlConnection')}
            </Typography>
          </Stack>
        </Box>
      </Box>
      <Box
        sx={(theme) => ({
          ...adminPanel(theme),
          p: 2,
          flexBasis: { md: 300 },
          display: { xs: 'none', md: 'block' },
        })}
      >
        <Typography variant="subtitle2">{t('admin.design.policyAuthority')}</Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
          {t('admin.design.policyAuthorityDescription')}
        </Typography>
      </Box>
    </Stack>
  );
}

export function MeetingAdminPolicyDesignSections({
  kind,
}: {
  kind: 'access' | 'capture' | 'ai' | 'templates' | 'legalHold';
}) {
  const { t } = useTranslation('meetings');
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const rows =
    kind === 'access'
      ? ['guestDomains', 'hostAbsenceTimeout']
      : kind === 'capture'
        ? ['recordingConsent', 'recordingNotice']
        : kind === 'ai'
          ? ['reviewer', 'masking', 'modelRouting']
          : kind === 'templates'
            ? ['templateApproval', 'departmentTemplates']
            : ['legalHold'];
  const content = rows.map((key) => (
    <Box
      component="details"
      key={key}
      open={!compact || undefined}
      data-testid={'meeting-policy-unavailable-' + key}
      sx={(theme) => ({
        ...adminInset(theme),
        p: { xs: 1, md: 1.5 },
        mb: 1,
        '& > summary': {
          minHeight: { xs: 44, md: 0 },
          cursor: 'pointer',
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main' },
        },
      })}
    >
      <Stack
        component="summary"
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
      >
        <Typography component="span" variant="body2" fontWeight="fontWeightMedium">
          {t(`admin.design.policyControls.${key}.label`)}
        </Typography>
        <Stack
          component="span"
          direction="row"
          alignItems="center"
          gap={0.5}
          sx={{ flexShrink: 0 }}
        >
          <LockKeyhole size={14} aria-hidden="true" />
          <Typography component="span" variant="caption" color="text.secondary">
            {t('admin.intelligence.unavailable')}
          </Typography>
        </Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {t(`admin.design.policyControls.${key}.description`)}
      </Typography>
    </Box>
  ));
  return kind === 'legalHold' || kind === 'access' || kind === 'capture' ? (
    <Box sx={{ p: kind === 'legalHold' ? 2 : 0 }}>{content}</Box>
  ) : (
    <MeetingAdminPolicySection
      number={kind === 'ai' ? '03' : '05'}
      defaultExpanded={kind !== 'templates'}
      title={t(kind === 'ai' ? 'admin.design.aiPolicyTitle' : 'admin.design.templatePolicyTitle')}
    >
      {content}
    </MeetingAdminPolicySection>
  );
}
