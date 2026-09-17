import { useTranslation } from 'react-i18next';
import { History, ShieldCheck } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { FormattedTime, Section, StateChip } from './mail-admin-operations-ui-shared';

import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type { MailPolicyGovernance } from './mail-admin-operations-model';

export function GovernanceSurface({
  overview,
  governance,
  canManage,
  onOpenSettings,
}: {
  overview: MailAdminOverview;
  governance?: MailPolicyGovernance;
  canManage: boolean;
  onOpenSettings?: () => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Stack spacing={2.5}>
      {!governance ? (
        <InlineFeedback severity="warning">
          {t('admin.operationsWorkspace.a04.configuredNotEnforced', {
            defaultValue:
              'Saved values are available, but effective enforcement evidence and history could not be loaded.',
          })}
        </InlineFeedback>
      ) : (
        <InlineFeedback severity="info">
          {t('admin.operationsWorkspace.sourceEvidence', {
            defaultValue: 'Evidence generated at {{time}}. Each source is evaluated independently.',
            time: governance.generatedAt,
          })}
        </InlineFeedback>
      )}
      <Section
        title={t('admin.operationsWorkspace.a04.effective', {
          defaultValue: 'Configured and effective policy',
        })}
        description={t('admin.operationsWorkspace.a04.effectiveDescription', {
          defaultValue:
            'An enabled setting is only marked enforced when current evidence confirms it.',
        })}
        action={
          onOpenSettings ? (
            <ActionButton
              intent="primary"
              disabled={!canManage}
              startIcon={<ShieldCheck size={16} />}
              onClick={onOpenSettings}
            >
              {t('admin.shared.configure')}
            </ActionButton>
          ) : undefined
        }
      >
        {governance?.rows.length
          ? governance.rows.map((row, index) => (
              <Box key={row.policyKey}>
                {index > 0 ? <Divider /> : null}
                <Box sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.25}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight="fontWeightBold">
                        {row.policyKey}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.scope} · {row.evidenceSource ?? 'No evidence source'} ·{' '}
                        <FormattedTime value={row.evidenceAt} />
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      {t('admin.operationsWorkspace.a04.configuredValue', {
                        defaultValue: 'Configured: {{value}}',
                        value: row.configuredValue,
                      })}
                    </Typography>
                    <Typography variant="body2">
                      {t('admin.operationsWorkspace.a04.effectiveValue', {
                        defaultValue: 'Effective: {{value}}',
                        value: row.effectiveValue ?? 'Unverified',
                      })}
                    </Typography>
                    <StateChip label={row.effectiveState} />
                  </Stack>
                  {row.errorCode ? (
                    <Typography variant="caption" color="error.main">
                      {row.errorCode}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            ))
          : [
              ['externalSenderBanner', overview.policy.externalSenderBanner],
              ['blockRemoteImages', overview.policy.blockRemoteImages],
              ['allowSharedInboxes', overview.policy.allowSharedInboxes],
              ['aiAssistanceEnabled', overview.policy.aiAssistanceEnabled],
              ['aiCrossAppActionsEnabled', overview.policy.aiCrossAppActionsEnabled],
            ].map(([policyKey, value], index) => (
              <Box key={String(policyKey)}>
                {index > 0 ? <Divider /> : null}
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 2 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold" sx={{ flex: 1 }}>
                    {policyKey}
                  </Typography>
                  <Typography variant="body2">
                    {t('admin.operationsWorkspace.a04.configuredValue', {
                      defaultValue: 'Configured: {{value}}',
                      value: value ? 'On' : 'Off',
                    })}
                  </Typography>
                  <StateChip label="UNVERIFIED" />
                </Stack>
              </Box>
            ))}
      </Section>
      <Section
        title={t('admin.operationsWorkspace.a04.history', {
          defaultValue: 'Policy change history',
        })}
        description={t('admin.operationsWorkspace.a04.historyDescription', {
          defaultValue: 'Versioned changes and application results.',
        })}
      >
        {governance?.history.length ? (
          governance.history.map((item, index) => (
            <Box key={item.historyId}>
              {index > 0 ? <Divider /> : null}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                sx={{ p: 2 }}
              >
                <History size={17} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    v{item.version} · {item.diffSummary}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.changedBy} · <FormattedTime value={item.changedAt} /> ·{' '}
                    {item.correlationId}
                  </Typography>
                </Box>
                <StateChip label={item.result} />
              </Stack>
            </Box>
          ))
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('admin.operationsWorkspace.a04.noHistory', {
                defaultValue: 'No policy history was returned.',
              })}
            </Typography>
          </Box>
        )}
      </Section>
    </Stack>
  );
}
