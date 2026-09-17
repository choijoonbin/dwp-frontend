import { useMemo } from 'react';
import { ExternalLink, Headphones, Plus, Printer, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import GlobalStyles from '@mui/material/GlobalStyles';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { workplaceServiceReference } from './workplace-services-ui-model';

import type { WorkplaceServiceOrder, WorkplaceServiceOrderLine } from '@dwp-frontend/shared-utils';

function servicesDeepLink(order: WorkplaceServiceOrder) {
  const params = new URLSearchParams({
    v: '1',
    period: 'UPCOMING',
    types: 'ALL',
    status: 'ACTIVE',
    authority: order.reservationAuthority,
    reservation: order.reservationId,
    reservationAuthority: order.reservationAuthority,
    tab: 'services',
  });
  return `/workplace/reservations?${params.toString()}`;
}

export function WorkplaceServiceOrderActions({ order }: { order: WorkplaceServiceOrder }) {
  const { t } = useTranslation('rooms');
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
      <ActionButton
        component={Link}
        to={servicesDeepLink(order)}
        intent="secondary"
        startIcon={<Plus size={16} />}
      >
        {t('workplace.services.extensions.addService')}
      </ActionButton>
      <ActionButton
        component="a"
        href="#workplace-service-contact"
        intent="quiet"
        startIcon={<Headphones size={16} />}
      >
        {t('workplace.services.extensions.contactServiceDesk')}
      </ActionButton>
      <ActionButton intent="quiet" startIcon={<Printer size={16} />} onClick={() => window.print()}>
        {t('workplace.services.extensions.print')}
      </ActionButton>
    </Stack>
  );
}

function PolicyLine({ line }: { line: WorkplaceServiceOrderLine }) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  return (
    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}>
      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Typography component="h4" variant="subtitle2">
          {korean ? line.nameKo : line.nameEn}
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={t('workplace.services.extensions.policySnapshotVersions', {
            catalog: line.catalogVersion,
            provider: line.providerConfigurationVersion,
          })}
        />
      </Stack>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(128px, auto) 1fr' },
          gap: 0.75,
        }}
      >
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.extensions.provider')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
          {line.providerCode} · {t(`workplace.services.providerStates.${line.providerState}`)}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.extensions.orderCutoff')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t('workplace.services.extensions.minutesBefore', {
            count: line.orderCutoffMinutes,
          })}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.extensions.cancellationCutoff')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t('workplace.services.extensions.minutesBefore', {
            count: line.cancellationCutoffMinutes,
          })}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.extensions.fulfillmentLead')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t('workplace.services.extensions.minutes', {
            count: line.slaFulfillmentLeadMinutes,
          })}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.extensions.policy')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
          {korean ? line.cancellationPolicyKo : line.cancellationPolicyEn}
        </Typography>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workplace.services.extensions.inspectionMode')}
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {t(`workplace.services.extensions.inspectionModes.${line.inspectionMode}`)}
        </Typography>
      </Box>
    </Box>
  );
}

export function WorkplaceServicePolicyDetails({ order }: { order: WorkplaceServiceOrder }) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  return (
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <AccordionSummary
        expandIcon={<ExternalLink size={16} aria-hidden="true" />}
        aria-controls="workplace-service-policy-content"
        id="workplace-service-policy-heading"
      >
        <Stack direction="row" gap={1} alignItems="center">
          <ShieldCheck size={17} aria-hidden="true" />
          <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
            {t('workplace.services.extensions.policyDetails')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails id="workplace-service-policy-content">
        <InlineFeedback severity="info">
          {t('workplace.services.extensions.frozenPolicyNotice', {
            time: formatDate(order.createdAt, { dateStyle: 'medium', timeStyle: 'short' }, locale),
          })}
        </InlineFeedback>
        <Stack spacing={1} mt={1.25}>
          {order.lines.map((line) => (
            <PolicyLine key={line.serviceOrderLineId} line={line} />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function WorkplaceServiceOrderPrintView({ order }: { order: WorkplaceServiceOrder }) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const korean = locale === 'ko';
  const total = useMemo(
    () => order.lines.reduce((sum, line) => sum + line.estimatedCost, 0),
    [order.lines]
  );
  return (
    <>
      <GlobalStyles
        styles={{
          '@media print': {
            'body *': { visibility: 'hidden !important' },
            '[data-workplace-service-print-root], [data-workplace-service-print-root] *': {
              visibility: 'visible !important',
            },
            '[data-workplace-service-print-root]': {
              position: 'absolute',
              inset: 0,
              width: '100%',
              color: '#111827',
              background: '#fff',
              padding: '18mm',
            },
            '[data-workplace-service-print-hidden]': { display: 'none !important' },
          },
        }}
      />
      <Box
        data-workplace-service-print-root
        aria-hidden="true"
        sx={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: 760,
          '@media print': { position: 'absolute', left: 0 },
        }}
      >
        <Typography component="h1" variant="h4" fontWeight="fontWeightBold">
          {t('workplace.services.extensions.printTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('workplace.services.auditReference', {
            id: workplaceServiceReference('order', order.serviceOrderId),
          })}
        </Typography>
        <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 1 }}>
          <Typography component="dt">{t('workplace.services.reservation')}</Typography>
          <Typography component="dd" sx={{ m: 0 }}>
            {workplaceServiceReference('reservation', order.reservationId)}
          </Typography>
          <Typography component="dt">{t('workplace.services.extensions.schedule')}</Typography>
          <Typography component="dd" sx={{ m: 0 }}>
            {formatDate(
              order.reservationStartsAt,
              { dateStyle: 'long', timeStyle: 'short' },
              locale
            )}
            {' – '}
            {formatDate(order.reservationEndsAt, { dateStyle: 'long', timeStyle: 'short' }, locale)}
          </Typography>
          <Typography component="dt">{t('workplace.services.extensions.orderState')}</Typography>
          <Typography component="dd" sx={{ m: 0 }}>
            {t(`workplace.services.orderStates.${order.state}`)}
          </Typography>
        </Box>
        <Stack spacing={1.25} mt={2}>
          {order.lines.map((line) => (
            <Box key={line.serviceOrderLineId} sx={{ borderTop: '1px solid #d1d5db', pt: 1 }}>
              <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                {korean ? line.nameKo : line.nameEn}
              </Typography>
              <Typography variant="body2">
                {t('workplace.services.extensions.printLine', {
                  quantity: line.quantity,
                  amount: formatNumber(line.estimatedCost, undefined, locale),
                  currency: line.currency,
                })}
              </Typography>
              <Typography variant="caption" display="block">
                {korean ? line.cancellationPolicyKo : line.cancellationPolicyEn}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Typography variant="subtitle1" fontWeight="fontWeightBold" mt={2}>
          {t('workplace.services.extensions.printTotal', {
            amount: formatNumber(total, undefined, locale),
            currency: order.currency,
          })}
        </Typography>
        <Typography variant="caption" display="block" mt={3}>
          {t('workplace.services.extensions.printPrivacyNotice')}
        </Typography>
      </Box>
    </>
  );
}
