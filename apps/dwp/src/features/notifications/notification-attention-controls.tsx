import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { BellDot, Clock3, Eye, LockKeyhole, RefreshCw, Save, ShieldAlert } from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { SelectField } from '@dwp-frontend/design-system/components/forms/select-field';
import { InlineFeedback } from '@dwp-frontend/design-system/components/inline-feedback/inline-feedback';
import { LoadingState } from '@dwp-frontend/design-system/components/states/state-panels';
import { formatDate } from '@dwp-frontend/shared-i18n/lib/formatters';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  isAttentionScopeActionable,
  selectedAttentionExpiration,
} from './notification-attention-model';

import type {
  NotificationAttentionImpactPreview,
  NotificationAttentionScopeOption,
} from './notification-attention-model';

function PreviewState({
  preview,
  onRebase,
}: {
  preview: NotificationAttentionImpactPreview;
  onRebase?: () => void;
}) {
  const { t } = useTranslation('notifications');
  if (preview.state === 'IDLE') {
    return (
      <Box sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Eye size={22} aria-hidden />
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {t('attention.controls.previewIdle')}
        </Typography>
      </Box>
    );
  }
  if (preview.state === 'LOADING') {
    return (
      <LoadingState
        label={t('attention.controls.previewLoading')}
        variant="skeleton"
        skeletonRows={2}
        skeletonHeight={32}
        embedded
      />
    );
  }
  if (preview.state === 'OFFLINE') {
    return <InlineFeedback severity="warning">{preview.message}</InlineFeedback>;
  }
  if (preview.state === 'ERROR') {
    return <InlineFeedback severity="error">{preview.message}</InlineFeedback>;
  }
  if (preview.state === 'CONFLICT') {
    return (
      <InlineFeedback
        severity="warning"
        title={t('attention.controls.conflictTitle')}
        action={
          onRebase ? (
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCw size={15} />}
              onClick={onRebase}
            >
              {t('attention.controls.rebase')}
            </ActionButton>
          ) : undefined
        }
      >
        <Typography variant="body2">{preview.message}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('attention.controls.asOf', {
            date: formatDate(preview.asOf, { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </Typography>
      </InlineFeedback>
    );
  }
  return (
    <Box role="status" aria-live="polite">
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="subtitle2">{t('attention.controls.expectedImpact')}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('attention.controls.asOf', {
            date: formatDate(preview.asOf, { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </Typography>
      </Stack>
      <Box component="ul" sx={{ mt: 0.75, mb: 0, pl: 2.25 }}>
        {preview.statements.map((statement, index) => (
          <Typography
            component="li"
            variant="body2"
            key={`${index}-${statement}`}
            sx={{ mb: 0.5, overflowWrap: 'anywhere' }}
          >
            {statement}
          </Typography>
        ))}
      </Box>
      {preview.policyNotices?.map((notice, index) => (
        <InlineFeedback key={`${index}-${notice}`} severity="info" sx={{ mt: 1 }}>
          {notice}
        </InlineFeedback>
      ))}
    </Box>
  );
}

export type NotificationAttentionControlsProps = {
  notificationTitle?: string;
  whyReceived: string;
  reasonDetails?: readonly string[];
  deliveryPolicyStatement?: string;
  scopeOptions: readonly NotificationAttentionScopeOption[];
  selectedOptionId: string | null;
  selectedExpirationId: string | null;
  preview: NotificationAttentionImpactPreview;
  mutationState?: 'IDLE' | 'SAVING' | 'REBASING';
  onOptionChange: (optionId: string) => void;
  onExpirationChange: (expirationId: string | null) => void;
  onPreview: (option: NotificationAttentionScopeOption, expirationId: string | null) => void;
  onApply: (option: NotificationAttentionScopeOption, expirationId: string | null) => void;
  onRebase?: () => void;
  onClose?: () => void;
};

export function NotificationAttentionControls({
  notificationTitle,
  whyReceived,
  reasonDetails = [],
  deliveryPolicyStatement,
  scopeOptions,
  selectedOptionId,
  selectedExpirationId,
  preview,
  mutationState = 'IDLE',
  onOptionChange,
  onExpirationChange,
  onPreview,
  onApply,
  onRebase,
  onClose,
}: NotificationAttentionControlsProps) {
  const { t } = useTranslation('notifications');
  const titleId = useId();
  const reasonId = useId();
  const selectedOption = scopeOptions.find((option) => option.optionId === selectedOptionId);
  const selectedExpiration = selectedAttentionExpiration(selectedOption, selectedExpirationId);
  const resolvedExpirationId = selectedExpiration?.optionId ?? null;
  const actionable = selectedOption ? isAttentionScopeActionable(selectedOption) : false;
  const needsExpiration = Boolean(selectedOption?.expirationOptions.length);
  const validSelection = actionable && (!needsExpiration || Boolean(selectedExpiration));
  const busy = mutationState !== 'IDLE' || preview.state === 'LOADING';
  const canApply = validSelection && preview.state === 'READY' && !busy;

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="notification-attention-controls"
      sx={{
        minWidth: 0,
        bgcolor: 'background.paper',
        containerType: 'inline-size',
        '& .MuiChip-filledInfo': { color: 'info.contrastText', bgcolor: 'info.dark' },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': { transition: 'none !important' },
        },
        '@media (forced-colors: active)': {
          border: '1px solid CanvasText',
          '& [data-attention-option="selected"]': { outline: '2px solid Highlight' },
        },
      }}
    >
      <Box sx={{ px: { xs: 1.25, sm: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <BellDot size={19} aria-hidden />
          <Box minWidth={0}>
            <Typography id={titleId} component="h2" variant="h6">
              {t('attention.controls.title')}
            </Typography>
            {notificationTitle && (
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {notificationTitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 1.25, sm: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography id={reasonId} component="h3" variant="subtitle2">
          {t('attention.controls.whyReceived')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
          {whyReceived}
        </Typography>
        {reasonDetails.length > 0 && (
          <Box component="ul" sx={{ mt: 0.75, mb: 0, pl: 2.25 }}>
            {reasonDetails.map((detail, index) => (
              <Typography component="li" variant="caption" key={`${index}-${detail}`}>
                {detail}
              </Typography>
            ))}
          </Box>
        )}
        {deliveryPolicyStatement && (
          <InlineFeedback severity="info" sx={{ mt: 1 }}>
            {deliveryPolicyStatement}
          </InlineFeedback>
        )}
      </Box>

      <FormControl
        component="fieldset"
        fullWidth
        sx={{ px: { xs: 1.25, sm: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <FormLabel component="legend" sx={{ typography: 'subtitle2', color: 'text.primary' }}>
          {t('attention.controls.availableScopes')}
        </FormLabel>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
          {t('attention.controls.serverSupplied')}
        </Typography>
        <RadioGroup
          value={selectedOptionId ?? ''}
          onChange={(event) => onOptionChange(event.target.value)}
          aria-describedby={reasonId}
          sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}
        >
          {scopeOptions.map((option) => {
            const selected = selectedOptionId === option.optionId;
            const locked = !isAttentionScopeActionable(option);
            return (
              <Box
                key={option.optionId}
                data-attention-option={selected ? 'selected' : option.availability.toLowerCase()}
                sx={{
                  py: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: selected ? 'action.selected' : undefined,
                }}
              >
                <FormControlLabel
                  value={option.optionId}
                  disabled={locked}
                  control={<Radio size="small" />}
                  sx={{ m: 0, alignItems: 'flex-start', width: '100%' }}
                  label={
                    <Box minWidth={0} sx={{ pt: 0.35 }}>
                      <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                          {option.label}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(`attention.actions.${option.action}`)}
                        />
                        {option.current && (
                          <Chip size="small" color="info" label={t('attention.controls.current')} />
                        )}
                        {locked && (
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<LockKeyhole size={13} />}
                            label={
                              option.availability === 'LOCKED'
                                ? t('attention.controls.policyLocked')
                                : t('attention.unavailable')
                            }
                          />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {option.description}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.35 }}>
                        {t('attention.controls.scope', { scope: option.scopeLabel })}
                      </Typography>
                      {option.policyLock && (
                        <Typography
                          variant="caption"
                          color="text.primary"
                          sx={{ display: 'block', mt: 0.35, overflowWrap: 'anywhere' }}
                        >
                          {option.policyLock.ownerLabel}: {option.policyLock.reason} ·{' '}
                          {option.policyLock.exceptionAllowed
                            ? t('attention.managed.exceptionAllowed')
                            : t('attention.managed.noException')}
                        </Typography>
                      )}
                      {!option.policyLock && option.unavailableReason && (
                        <Typography variant="caption" color="text.secondary">
                          {option.unavailableReason}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </Box>
            );
          })}
        </RadioGroup>
      </FormControl>

      <Box
        sx={{
          px: { xs: 1.25, sm: 2 },
          py: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
          gap: 1,
          alignItems: 'end',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <SelectField
          size="small"
          label={t('attention.fields.expiry')}
          value={selectedExpirationId ?? ''}
          disabled={!selectedOption || !actionable || selectedOption.expirationOptions.length === 0}
          onValueChange={(value) => onExpirationChange(value || null)}
          supportingText={
            selectedOption?.expirationOptions.length === 0
              ? t('attention.controls.noExpiryChoice')
              : t('attention.controls.serverExpiryOnly')
          }
          options={
            selectedOption?.expirationOptions.map((expiration) => ({
              value: expiration.optionId,
              label: expiration.label,
            })) ?? []
          }
        />
        <ActionButton
          intent="secondary"
          startIcon={<Eye size={16} />}
          disabled={!validSelection || busy}
          onClick={() => {
            if (selectedOption) onPreview(selectedOption, resolvedExpirationId);
          }}
        >
          {t('attention.controls.previewAction')}
        </ActionButton>
      </Box>

      <Box sx={{ px: { xs: 1.25, sm: 2 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <PreviewState preview={preview} onRebase={onRebase} />
      </Box>

      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        justifyContent="flex-end"
        gap={1}
        sx={{ px: { xs: 1.25, sm: 2 }, py: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {onClose && (
          <ActionButton intent="quiet" onClick={onClose}>
            {t('actions.close')}
          </ActionButton>
        )}
        <ActionButton
          intent="primary"
          startIcon={mutationState === 'REBASING' ? <RefreshCw size={16} /> : <Save size={16} />}
          disabled={!canApply}
          loading={mutationState === 'SAVING' || mutationState === 'REBASING'}
          loadingLabel={
            mutationState === 'REBASING'
              ? t('attention.controls.rebasing')
              : t('attention.controls.saving')
          }
          onClick={() => {
            if (selectedOption) onApply(selectedOption, resolvedExpirationId);
          }}
        >
          {t('attention.controls.apply')}
        </ActionButton>
      </Stack>

      {!selectedOption && scopeOptions.length === 0 && (
        <InlineFeedback severity="info" icon={<ShieldAlert size={20} />} sx={{ m: 1.25 }}>
          {t('attention.controls.none')}
        </InlineFeedback>
      )}
      {selectedExpiration?.expiresAt && (
        <Box
          role="status"
          sx={{ px: 1.25, py: 0.75, display: 'flex', gap: 0.75, color: 'text.secondary' }}
        >
          <Clock3 size={14} aria-hidden />
          <Typography variant="caption">
            {t('attention.controls.selectedExpiry', {
              date: formatDate(selectedExpiration.expiresAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
