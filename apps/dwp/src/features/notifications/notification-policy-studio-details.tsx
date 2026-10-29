import { useTranslation } from 'react-i18next';
import { Building2, PencilLine } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NotificationPolicyComparison } from './notification-governance-comparison';
import { NotificationPolicyChannels } from './notification-policy-channels';
import { notificationPolicySourceTone } from './notification-policy-studio-model';

import type { TenantNotificationPolicy } from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationPolicyListItem({
  policy,
  selected,
  onSelect,
}: {
  policy: TenantNotificationPolicy;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        width: 1,
        px: 1.75,
        py: 1.25,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 1,
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : undefined,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box minWidth={0}>
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
          {policy.scopeLabel}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', overflowWrap: 'anywhere' }}
        >
          {policy.scopeType} · {policy.scopeKey}
        </Typography>
        <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
          <Chip
            size="small"
            variant="outlined"
            color={notificationPolicySourceTone(policy.source)}
            label={t(`admin.policies.source.${policy.source}`)}
          />
          {policy.mandatory && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('admin.policies.mandatory')}
            />
          )}
        </Stack>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('admin.policies.versionLabel', { version: policy.version })}
      </Typography>
    </ButtonBase>
  );
}

export function NotificationPolicyDetail({
  policy,
  canManage,
  hasDraft,
  draft,
  onEdit,
}: {
  policy: TenantNotificationPolicy;
  canManage: boolean;
  hasDraft: boolean;
  draft?: TenantNotificationPolicy;
  onEdit: () => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box component="section" sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1.5}
      >
        <Box minWidth={0}>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            <Chip size="small" variant="outlined" label={policy.scopeType} />
            <Chip
              size="small"
              variant="outlined"
              color={notificationPolicySourceTone(policy.source)}
              label={t(`admin.policies.source.${policy.source}`)}
            />
          </Stack>
          <Typography component="h2" variant="h6" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
            {policy.scopeLabel}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.35, overflowWrap: 'anywhere' }}
          >
            {policy.scopeKey}
          </Typography>
        </Box>
        {canManage && (
          <ActionButton
            intent="secondary"
            startIcon={<PencilLine size={17} />}
            onClick={onEdit}
            disabled={hasDraft}
          >
            {hasDraft ? t('admin.policies.draftExists') : t('admin.policies.proposeChange')}
          </ActionButton>
        )}
      </Stack>

      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {[
          [
            t('admin.policies.fields.mandatory'),
            t(`admin.policies.${policy.mandatory ? 'yes' : 'no'}`),
          ],
          [
            t('admin.policies.fields.quietHours'),
            t(`admin.policies.${policy.quietHoursBypass ? 'bypass' : 'respectQuietHours'}`),
          ],
          [t('admin.policies.fields.digest'), t(`admin.policies.digest.${policy.digestMode}`)],
        ].map(([label, value]) => (
          <Box
            key={label}
            sx={{
              minWidth: 0,
              py: 1,
              pr: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              overflowWrap: 'anywhere',
            }}
          >
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" fontWeight={700} sx={{ m: 0, mt: 0.35 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {draft ? (
        <Box sx={{ mt: 2, borderLeft: 3, borderColor: 'warning.main', pl: 1.5 }}>
          <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('admin.policies.draft')}
            />
            <Typography variant="caption" color="text.secondary">
              {t('admin.policies.versionLabel', { version: draft.version })}
            </Typography>
          </Stack>
          <NotificationPolicyComparison current={policy} proposed={draft} />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, overflowWrap: 'anywhere' }}
          >
            {draft.changeReason}
          </Typography>
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
            {t('admin.policies.independentApprovalRequired')}
          </Typography>
        </Box>
      ) : (
        <>
          <Typography component="h3" variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
            {t('admin.policies.channelsTitle')}
          </Typography>
          <NotificationPolicyChannels channels={policy.channels} />
        </>
      )}

      {policy.source === 'PROVIDER_POLICY' && (
        <Alert severity="info" icon={<Building2 size={18} />} sx={{ mt: 2 }}>
          {t('admin.policies.providerInheritance')}
        </Alert>
      )}
    </Box>
  );
}
