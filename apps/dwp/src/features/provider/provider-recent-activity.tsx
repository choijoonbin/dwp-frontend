import { useTranslation } from 'react-i18next';
import { ArrowRight, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ProviderRecentActivity } from '@dwp-frontend/shared-utils';

import { providerAuditCategory } from './provider-audit-presentation';
import { formatProviderDate, ProviderSectionHeading, ProviderStatusChip } from './provider-ui';

export function ProviderRecentActivitySection({
  activity,
}: {
  activity: ProviderRecentActivity[];
}) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const navigate = useNavigate();

  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <ProviderSectionHeading
        title={t('command.activity.title')}
        description={t('command.activity.description')}
        action={
          <ActionButton
            intent="quiet"
            size="small"
            endIcon={<ArrowRight size={16} />}
            onClick={() => navigate('/provider/audit')}
          >
            {t('actions.viewAll')}
          </ActionButton>
        }
      />
      <Stack divider={<Divider flexItem />} sx={{ mt: 1.75 }}>
        {activity.slice(0, 6).map((event) => (
          <ButtonBase
            key={event.auditEventId}
            onClick={() => navigate('/provider/audit')}
            sx={{ width: 1, py: 1.05, textAlign: 'left', justifyContent: 'flex-start' }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 30,
                height: 30,
                flex: '0 0 30px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: 'info.main',
                bgcolor: 'action.hover',
              }}
            >
              <Radio size={15} />
            </Box>
            <Box sx={{ ml: 1, minWidth: 0, flex: 1 }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {t(`audit.categories.${providerAuditCategory(event.category)}`)}
                </Typography>
                <ProviderStatusChip state={event.outcome} />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                noWrap
                display="block"
                sx={{ fontFamily: foundationTokens.font.mono }}
              >
                {display('auditActions', event.action)}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {event.operatorName ?? t('audit.global')} · {event.tenantKey ?? t('audit.global')}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1, whiteSpace: 'nowrap' }}
            >
              {formatProviderDate(event.occurredAt)}
            </Typography>
          </ButtonBase>
        ))}
      </Stack>
    </Paper>
  );
}
