import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Clock3, Code2, Eye, LocateFixed, SlidersHorizontal } from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { FormDialog } from '@dwp-frontend/design-system/components/dialogs/form-dialog';
import { AutocompleteField } from '@dwp-frontend/design-system/components/forms/autocomplete-field';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { SelectField } from '@dwp-frontend/design-system/components/forms/select-field';
import { InlineFeedback } from '@dwp-frontend/design-system/components/inline-feedback/inline-feedback';
import { DateTimePickerField } from '@dwp-frontend/design-system/enterprise/date-time/date-picker-field';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  attentionScopeKeyIsCanonical,
  attentionScheduleIsValid,
  preferredAttentionEffect,
} from './notification-attention-scope-discovery';

import type {
  NotificationAttentionRule,
  NotificationAttentionRuleInput,
  NotificationAttentionRulePreview,
  NotificationAttentionScopeKind,
} from '@dwp-frontend/shared-utils/api/notification-attention-api';
import type { NotificationChannel } from '@dwp-frontend/shared-utils/api/notification-contract';
import type {
  NotificationAttentionDiscoveryState,
  NotificationAttentionScopeCatalog,
  NotificationAttentionScopeChoice,
} from './notification-attention-scope-discovery';

const CHANNELS: NotificationChannel[] = [
  'IN_APP',
  'EMAIL',
  'WEB_PUSH',
  'MOBILE_PUSH',
  'TEAMS',
  'SLACK',
];

const SCOPE_KINDS: NotificationAttentionScopeKind[] = [
  'APP_TYPE',
  'ACTOR',
  'THREAD',
  'RESOURCE',
  'TOPIC_TOKEN',
];

function DialogSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface,
      }}
    >
      <Stack
        direction="row"
        gap={1}
        alignItems="flex-start"
        sx={{ px: 1.5, py: 1.25, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}
      >
        <Box aria-hidden="true" sx={{ color: 'primary.main', pt: 0.15 }}>
          {icon}
        </Box>
        <Box minWidth={0}>
          <Typography component="h3" variant="subtitle2">
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
      <Stack gap={1.25} sx={{ p: 1.5 }}>
        {children}
      </Stack>
    </Box>
  );
}

function defaultInput(): NotificationAttentionRuleInput {
  return {
    scopeKind: 'APP_TYPE',
    scopeKey: '',
    displayLabel: '',
    effect: 'MUTE',
    channels: { IN_APP: true },
    startsAt: null,
    expiresAt: null,
    enabled: true,
  };
}

function fromRule(rule: NotificationAttentionRule): NotificationAttentionRuleInput {
  return {
    scopeKind: rule.scopeKind,
    scopeKey: rule.scopeKey,
    displayLabel: rule.displayLabel ?? '',
    effect: rule.effect,
    channels: rule.channels,
    startsAt: rule.startsAt,
    expiresAt: rule.expiresAt,
    enabled: rule.enabled,
  };
}

export function NotificationAttentionRuleDialog({
  open,
  initialRule,
  preview,
  busy,
  previewing,
  onClose,
  onPreview,
  onSave,
  onDraftChange,
  scopeCatalog = {},
  discoveryStates = {},
  onDiscoveryQueryChange,
}: {
  open: boolean;
  initialRule: NotificationAttentionRule | null;
  preview: NotificationAttentionRulePreview | null;
  busy: boolean;
  previewing: boolean;
  onClose: () => void;
  onPreview: (input: NotificationAttentionRuleInput) => void;
  onSave: (input: NotificationAttentionRuleInput) => void;
  onDraftChange: () => void;
  scopeCatalog?: NotificationAttentionScopeCatalog;
  discoveryStates?: Partial<
    Record<NotificationAttentionScopeKind, NotificationAttentionDiscoveryState>
  >;
  onDiscoveryQueryChange?: (kind: NotificationAttentionScopeKind, query: string) => void;
}) {
  const { t } = useTranslation('notifications');
  const [draft, setDraft] = useState<NotificationAttentionRuleInput>(defaultInput);
  const [discoveryQuery, setDiscoveryQuery] = useState('');
  const editing = Boolean(initialRule);

  useEffect(() => {
    if (!open) return;
    const next = initialRule ? fromRule(initialRule) : defaultInput();
    setDraft(next);
    setDiscoveryQuery(next.displayLabel?.trim() || '');
  }, [initialRule, open]);

  const scopeChoices = useMemo(
    () => scopeCatalog[draft.scopeKind] ?? [],
    [draft.scopeKind, scopeCatalog]
  );
  const discoveryState = discoveryStates[draft.scopeKind] ?? 'IDLE';
  const catalogChoice = useMemo(
    () => scopeChoices.find((choice) => choice.key === draft.scopeKey) ?? null,
    [draft.scopeKey, scopeChoices]
  );
  const preserveExistingExactKey = Boolean(
    editing && draft.scopeKey && !catalogChoice && discoveryState !== 'LOADING'
  );
  const selectedChoice = useMemo<NotificationAttentionScopeChoice | null>(() => {
    if (catalogChoice) return catalogChoice;
    if (!editing || !draft.scopeKey || discoveryState !== 'LOADING') return null;
    return {
      kind: draft.scopeKind,
      key: draft.scopeKey,
      label: draft.displayLabel?.trim() || draft.scopeKey,
    };
  }, [catalogChoice, discoveryState, draft.displayLabel, draft.scopeKey, draft.scopeKind, editing]);

  const valid = useMemo(
    () =>
      attentionScopeKeyIsCanonical(draft.scopeKind, draft.scopeKey) &&
      (draft.displayLabel?.trim().length ?? 0) <= 160 &&
      attentionScheduleIsValid(draft.startsAt, draft.expiresAt),
    [draft.displayLabel, draft.expiresAt, draft.scopeKey, draft.scopeKind, draft.startsAt]
  );

  const update = (next: NotificationAttentionRuleInput) => {
    setDraft(next);
    onDraftChange();
  };

  return (
    <FormDialog
      open={open}
      title={t(editing ? 'attention.dialog.editTitle' : 'attention.dialog.createTitle')}
      description={t('attention.dialog.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('attention.dialog.saving')}
      onClose={onClose}
      onSubmit={() => onSave(draft)}
      busy={busy}
      submitDisabled={!valid || !preview?.allowed || previewing}
      maxWidth="md"
      mobileFullScreen
      secondaryActions={
        <ActionButton
          intent="secondary"
          startIcon={<Eye size={16} />}
          disabled={!valid || busy}
          loading={previewing}
          onClick={() => onPreview(draft)}
        >
          {t('attention.dialog.preview')}
        </ActionButton>
      }
    >
      <Stack gap={1.5}>
        <DialogSection
          icon={<LocateFixed size={18} />}
          title={t('attention.dialog.targetSection')}
          description={t('attention.dialog.targetSectionDescription')}
        >
          <SelectField
            size="small"
            label={t('attention.dialog.scopeKind')}
            value={draft.scopeKind}
            disabled={editing || busy}
            onValueChange={(value) => {
              if (!value) return;
              const scopeKind = value as NotificationAttentionScopeKind;
              setDiscoveryQuery('');
              onDiscoveryQueryChange?.(scopeKind, '');
              update({
                ...draft,
                scopeKind,
                scopeKey: '',
                displayLabel: '',
                effect: preferredAttentionEffect(scopeKind),
              });
            }}
            options={SCOPE_KINDS.map((kind) => ({
              value: kind,
              label: t(`attention.scopeKinds.${kind}`),
            }))}
          />
          {preserveExistingExactKey ? (
            <Box sx={{ border: 1, borderColor: 'warning.light', bgcolor: 'warning.50', p: 1.25 }}>
              <Stack direction="row" gap={0.75} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  size="small"
                  icon={<Code2 size={14} />}
                  label={t('attention.dialog.legacyTarget')}
                />
                <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                  {draft.displayLabel}
                </Typography>
              </Stack>
              <FormField
                size="small"
                label={t('attention.dialog.scopeKey')}
                supportingText={t('attention.dialog.scopeKeyHelp')}
                value={draft.scopeKey}
                disabled
              />
              {discoveryState === 'ERROR' && (
                <InlineFeedback severity="error">{t('attention.loadFailed')}</InlineFeedback>
              )}
            </Box>
          ) : (
            <>
              <AutocompleteField<NotificationAttentionScopeChoice>
                size="small"
                label={t(`attention.scopeKinds.${draft.scopeKind}`)}
                value={selectedChoice}
                options={scopeChoices}
                loading={discoveryState === 'LOADING'}
                disabled={editing || busy || discoveryState === 'ERROR'}
                inputValue={discoveryQuery}
                onInputChange={(_, value, reason) => {
                  setDiscoveryQuery(value);
                  if (
                    reason === 'input' &&
                    ['ACTOR', 'RESOURCE', 'TOPIC_TOKEN'].includes(draft.scopeKind)
                  ) {
                    onDiscoveryQueryChange?.(draft.scopeKind, value);
                  }
                }}
                onChange={(_, choice) => {
                  setDiscoveryQuery(choice?.label ?? '');
                  update({
                    ...draft,
                    scopeKey: choice?.key ?? '',
                    displayLabel: choice?.label.slice(0, 160) ?? '',
                  });
                }}
                getOptionLabel={(choice) => choice.label}
                isOptionEqualToValue={(option, value) =>
                  option.kind === value.kind && option.key === value.key
                }
                filterOptions={(options, state) => {
                  const query = state.inputValue.trim().toLocaleLowerCase();
                  if (!query) return [...options];
                  return options.filter(
                    (option) =>
                      option.label.toLocaleLowerCase().includes(query) ||
                      option.detail?.toLocaleLowerCase().includes(query)
                  );
                }}
                renderOption={(props, choice) => (
                  <Box component="li" {...props} key={`${choice.kind}:${choice.key}`}>
                    <Box minWidth={0}>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {choice.label}
                      </Typography>
                      {choice.detail && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', overflowWrap: 'anywhere' }}
                        >
                          {choice.detail}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                supportingText={t('attention.dialog.discoveryHelp')}
                noOptionsText={t('attention.emptyDescription')}
              />
              {discoveryState === 'ERROR' && (
                <InlineFeedback severity="error">{t('attention.loadFailed')}</InlineFeedback>
              )}
              {selectedChoice && (
                <InlineFeedback severity="info" title={t('attention.dialog.selectedTarget')}>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {selectedChoice.label}
                  </Typography>
                  {selectedChoice.detail && (
                    <Typography variant="caption" color="text.secondary">
                      {selectedChoice.detail}
                    </Typography>
                  )}
                </InlineFeedback>
              )}
            </>
          )}
          <FormField
            size="small"
            label={t('attention.dialog.displayLabel')}
            value={draft.displayLabel ?? ''}
            disabled={busy}
            inputProps={{ maxLength: 160 }}
            onChange={(event) => update({ ...draft, displayLabel: event.target.value })}
          />
        </DialogSection>

        <DialogSection
          icon={<SlidersHorizontal size={18} />}
          title={t('attention.dialog.behaviorSection')}
          description={t('attention.dialog.behaviorSectionDescription')}
        >
          <SelectField
            size="small"
            label={t('attention.dialog.effect')}
            value={draft.effect}
            disabled={busy}
            onValueChange={(value) =>
              value &&
              update({
                ...draft,
                effect: value as NotificationAttentionRuleInput['effect'],
              })
            }
            options={(['PRIORITIZE', 'FOLLOW', 'MUTE'] as const).map((effect) => ({
              value: effect,
              label: t(`attention.effects.${effect}`),
            }))}
          />
          <Box>
            <Stack direction="row" gap={0.75} alignItems="center">
              <BellRing size={16} aria-hidden />
              <Typography component="h4" variant="subtitle2">
                {t('attention.dialog.channels')}
              </Typography>
            </Stack>
            <Box
              sx={{
                mt: 0.5,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 0.25,
              }}
            >
              {CHANNELS.map((channel) => (
                <FormControlLabel
                  key={channel}
                  sx={{
                    minWidth: 0,
                    m: 0,
                    '& .MuiFormControlLabel-label': { overflowWrap: 'anywhere' },
                  }}
                  control={
                    <Checkbox
                      size="small"
                      checked={Boolean(draft.channels?.[channel])}
                      disabled={busy}
                      onChange={(event) =>
                        update({
                          ...draft,
                          channels: { ...draft.channels, [channel]: event.target.checked },
                        })
                      }
                    />
                  }
                  label={t(`channels.${channel}`)}
                />
              ))}
            </Box>
          </Box>
        </DialogSection>

        <DialogSection
          icon={<Clock3 size={18} />}
          title={t('attention.dialog.scheduleSection')}
          description={t('attention.dialog.scheduleSectionDescription')}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            <DateTimePickerField
              size="small"
              label={t('attention.dialog.startsAt')}
              value={draft.startsAt ?? null}
              disabled={busy}
              onValueChange={(value) => update({ ...draft, startsAt: value })}
            />
            <DateTimePickerField
              size="small"
              label={t('attention.dialog.expiresAt')}
              value={draft.expiresAt ?? null}
              disabled={busy}
              onValueChange={(value) => update({ ...draft, expiresAt: value })}
            />
          </Box>
          {!attentionScheduleIsValid(draft.startsAt, draft.expiresAt) && (
            <InlineFeedback severity="error">
              {`${t('attention.dialog.startsAt')} < ${t('attention.dialog.expiresAt')}`}
            </InlineFeedback>
          )}
        </DialogSection>

        {preview && (
          <InlineFeedback severity={preview.allowed ? 'success' : 'error'}>
            {preview.allowed
              ? preview.estimateAvailable
                ? t('attention.dialog.previewAllowed', {
                    count: preview.estimatedAffectedCount,
                  })
                : t('attention.dialog.previewAllowedNoEstimate')
              : t('attention.dialog.previewBlocked', {
                  reason: preview.conflictReason ?? t('attention.dialog.policyConflict'),
                })}
          </InlineFeedback>
        )}
      </Stack>
    </FormDialog>
  );
}
