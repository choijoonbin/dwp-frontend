import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';
import type { HomeWidgetRuntimeDecision } from './runtime/widget-registry-runtime';

export function HomeWidgetRuntimeBoundary({
  decision,
  label,
  children,
}: {
  decision: HomeWidgetRuntimeDecision;
  label: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('home');
  if (decision.render === 'UNAVAILABLE') {
    return (
      <Box
        component="section"
        role="status"
        aria-label={t('widgetRuntime.unavailableLabel', { label })}
        data-widget-runtime-state="unavailable"
        sx={{ minHeight: 128, display: 'grid', placeItems: 'center', p: 2.5 }}
      >
        <Stack alignItems="center" gap={1} textAlign="center" sx={{ maxWidth: 380 }}>
          <ShieldAlert size={24} aria-hidden="true" />
          <Typography component="h3" variant="subtitle2">
            {t('widgetRuntime.unavailableTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`widgetRuntime.reasons.${decision.publicReason}`)}
          </Typography>
        </Stack>
      </Box>
    );
  }
  if (!decision.deprecated) {
    return (
      <Box
        data-widget-runtime-state="available"
        data-workspace-widget-transparent
        sx={{ display: 'contents' }}
      >
        {children}
      </Box>
    );
  }
  return (
    <Stack gap={1} data-widget-runtime-state="deprecated" data-workspace-widget-transparent>
      <InlineFeedback severity="warning" sx={{ py: 0 }}>
        {t('widgetRuntime.deprecatedNotice')}
      </InlineFeedback>
      {children}
    </Stack>
  );
}
