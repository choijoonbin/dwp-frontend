import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { useNavigate } from 'react-router-dom';
import { History, RefreshCw } from 'lucide-react';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import { saveWorkplaceConnector, saveWorkplaceSharingPolicy } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GovernancePanel } from './workplace-admin-governance-ui';
import {
  governanceChangeOutcome,
  governanceReviewFingerprint,
} from './workplace-governance-change-model';
import type { GovernanceChangeOutcome } from './workplace-governance-change-model';
import type {
  WorkplaceConnectorStatus,
  WorkplaceSharingPolicy,
  WorkplaceSharingVisibility,
} from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

function useSettingsChange<T>({
  contextKey,
  proposed,
  sourceReady,
  canManage,
  valid,
  save,
  refresh,
}: {
  contextKey: string;
  proposed: T;
  sourceReady: boolean;
  canManage: boolean;
  valid: boolean;
  save: (input: T & { reason: string; confirmed: boolean }) => Promise<unknown>;
  refresh: () => Promise<boolean>;
}) {
  const fingerprint = governanceReviewFingerprint(
    JSON.stringify([contextKey, canManage]),
    proposed
  );
  const active = useRef({ fingerprint, contextKey, canManage, generation: 0, mounted: true });
  if (active.current.fingerprint !== fingerprint) active.current.generation += 1;
  Object.assign(active.current, { fingerprint, contextKey, canManage });
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GovernanceChangeOutcome | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const instance = active.current;
    instance.mounted = true;
    return () => {
      instance.mounted = false;
    };
  }, []);
  useEffect(() => {
    setConfirmedKey(null);
  }, [fingerprint]);
  useEffect(() => {
    if (!canManage) {
      setReason('');
      setConfirmedKey(null);
    }
  }, [canManage]);
  useEffect(() => {
    if (!sourceReady) setConfirmedKey(null);
  }, [sourceReady]);
  useEffect(() => {
    setSaved(false);
    setOutcome(null);
    setReason('');
  }, [contextKey]);
  const confirmed = confirmedKey === fingerprint;
  const canSave =
    canManage &&
    sourceReady &&
    valid &&
    confirmed &&
    Boolean(reason.trim()) &&
    reason.trim().length <= 500 &&
    !busy &&
    !outcome &&
    !saved;
  async function run(recheck: boolean) {
    if (lock.current || !canManage || (!recheck && !canSave)) return;
    lock.current = true;
    setBusy(true);
    const generation = active.current.generation;
    const sameContext = () =>
      active.current.mounted &&
      active.current.contextKey === contextKey &&
      active.current.canManage;
    try {
      if (recheck) {
        if ((await refresh()) && sameContext()) {
          setOutcome(null);
          setConfirmedKey(null);
        }
      } else {
        await save({ ...proposed, reason: reason.trim(), confirmed });
        if (sameContext() && generation === active.current.generation) {
          setConfirmedKey(null);
          await refresh();
          if (sameContext()) setSaved(true);
        }
      }
    } catch (error) {
      if (sameContext() && (recheck || generation === active.current.generation)) {
        setOutcome(governanceChangeOutcome(error, !recheck));
        setConfirmedKey(null);
      }
    } finally {
      lock.current = false;
      if (active.current.mounted) setBusy(false);
    }
  }
  return {
    busy,
    reason,
    confirmed,
    outcome,
    saved,
    canSave,
    disabled: busy || Boolean(outcome) || saved || !canManage,
    setReason: (value: string) => {
      setReason(value);
      setConfirmedKey(null);
    },
    setConfirmed: (value: boolean) =>
      setConfirmedKey(value && sourceReady && valid && canManage ? fingerprint : null),
    save: () => void run(false),
    recheck: () => void run(true),
  };
}

type SettingsState = ReturnType<typeof useSettingsChange<unknown>>;
function SettingsConfirmation({
  state,
  sourceReady,
  children,
}: {
  state: SettingsState;
  sourceReady: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('rooms');
  const navigate = useNavigate();
  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Box
        component="fieldset"
        disabled={state.disabled}
        sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
      >
        <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold" sx={{ mb: 1 }}>
          {t('workplace.experience.proposedValues')}
        </Typography>
        {children}
      </Box>
      {!sourceReady ? (
        <InlineFeedback severity="warning">
          {t('workplace.experience.sourceNotCurrent')}
        </InlineFeedback>
      ) : null}
      <FormField
        required
        label={t('workplace.experience.reason')}
        multiline
        minRows={2}
        value={state.reason}
        inputProps={{ maxLength: 500 }}
        disabled={state.disabled}
        onChange={(event) => state.setReason(event.target.value)}
      />
      <FormControlLabel
        sx={{ m: 0, alignItems: 'flex-start' }}
        control={
          <Checkbox
            checked={state.confirmed}
            disabled={!sourceReady || state.disabled}
            onChange={(event) => state.setConfirmed(event.target.checked)}
          />
        }
        label={t('workplace.experience.confirmSettingsChange')}
      />
      {state.outcome ? (
        <InlineFeedback
          severity="error"
          action={
            state.outcome === 'denied' ? undefined : (
              <ActionButton
                intent="secondary"
                startIcon={<RefreshCw size={15} />}
                loading={state.busy}
                onClick={state.recheck}
              >
                {t('workplace.experience.recheck')}
              </ActionButton>
            )
          }
        >
          {t(
            `workplace.experience.${state.outcome === 'conflict' ? 'conflict' : state.outcome === 'denied' ? 'permissionChanged' : state.outcome === 'unknown' ? 'changeUnknown' : state.outcome === 'invalid' ? 'invalidChange' : 'reviewUnavailable'}`
          )}
        </InlineFeedback>
      ) : null}
      {state.saved ? (
        <InlineFeedback severity="success">{t('workplace.experience.changeSaved')}</InlineFeedback>
      ) : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <ActionButton
          intent="primary"
          disabled={!state.canSave}
          loading={state.busy}
          onClick={state.save}
        >
          {t('workplace.experience.saveReviewedChange')}
        </ActionButton>
        {state.saved || state.outcome === 'unknown' ? (
          <ActionButton
            intent="secondary"
            startIcon={<History size={15} />}
            onClick={() => navigate('/workplace/admin/operations?view=audit')}
          >
            {t('workplace.experience.viewAudit')}
          </ActionButton>
        ) : null}
      </Stack>
    </Stack>
  );
}

export function SharingPolicyEditor({
  policy,
  contextKey,
  sourceReady,
  canManage,
  refresh,
}: {
  policy: WorkplaceSharingPolicy;
  contextKey: string;
  sourceReady: boolean;
  canManage: boolean;
  refresh: () => Promise<boolean>;
}) {
  const { t } = useTranslation('rooms');
  const [draft, setDraft] = useState(policy);
  useEffect(() => {
    setDraft((current) => ({ ...current, version: policy.version }));
  }, [policy.version]);
  const changed =
    draft.sharingEnabled !== policy.sharingEnabled ||
    draft.maximumVisibility !== policy.maximumVisibility;
  const state = useSettingsChange({
    contextKey,
    proposed: draft,
    sourceReady,
    canManage,
    valid: changed,
    save: saveWorkplaceSharingPolicy,
    refresh,
  });
  return (
    <SettingsConfirmation state={state} sourceReady={sourceReady}>
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {t('workplace.experience.currentPolicy', {
            enabled: t(
              policy.sharingEnabled
                ? 'workplace.experience.enabled'
                : 'workplace.experience.disabled'
            ),
            visibility: t(`workplace.experience.visibility.${policy.maximumVisibility}`),
            version: policy.version,
          })}
        </Typography>
        <FormControlLabel
          sx={{ m: 0 }}
          control={
            <Checkbox
              checked={draft.sharingEnabled}
              onChange={(event) => setDraft({ ...draft, sharingEnabled: event.target.checked })}
            />
          }
          label={t('workplace.experience.sharingEnabled')}
        />
        <SelectField
          label={t('workplace.experience.maximumVisibility')}
          value={draft.maximumVisibility}
          options={(['PRIVATE', 'SITE', 'FLOOR', 'RESOURCE'] as const).map((value) => ({
            value,
            label: t(`workplace.experience.visibility.${value}`),
          }))}
          onValueChange={(value) =>
            setDraft({ ...draft, maximumVisibility: value as WorkplaceSharingVisibility })
          }
        />
        <InlineFeedback severity="info">
          {t('workplace.experience.sharingPolicyImpact')}
        </InlineFeedback>
      </Stack>
    </SettingsConfirmation>
  );
}

export function ConnectorEditor({
  connector,
  contextKey,
  sourceReady,
  canManage,
  refresh,
}: {
  connector: WorkplaceConnectorStatus;
  contextKey: string;
  sourceReady: boolean;
  canManage: boolean;
  refresh: () => Promise<boolean>;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const [draft, setDraft] = useState({
    provider: connector.provider ?? '',
    configurationReference: connector.configurationReference ?? '',
    enabled: connector.status === 'CONFIGURED_UNVERIFIED',
    version: connector.version,
  });
  useEffect(() => {
    setDraft((current) => ({ ...current, version: connector.version }));
  }, [connector.version]);
  const changed =
    draft.provider.trim() !== (connector.provider ?? '') ||
    draft.configurationReference.trim() !== (connector.configurationReference ?? '') ||
    draft.enabled !== (connector.status === 'CONFIGURED_UNVERIFIED');
  const valid =
    changed &&
    Boolean(draft.provider.trim()) &&
    /^[A-Za-z0-9._-]{1,80}$/.test(draft.provider) &&
    (!draft.configurationReference ||
      /^[A-Za-z0-9._:/-]{1,160}$/.test(draft.configurationReference));
  const state = useSettingsChange({
    contextKey,
    proposed: draft,
    sourceReady,
    canManage,
    valid,
    save: (input) =>
      saveWorkplaceConnector(connector.kind, {
        ...input,
        configurationReference: input.configurationReference || null,
      }),
    refresh,
  });
  return (
    <GovernancePanel
      title={t(`workplace.experience.connectorKinds.${connector.kind}`)}
      description={t('workplace.experience.connectorMetadataDescription')}
    >
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <InlineFeedback severity="info">
          {t(`workplace.experience.connectorStatuses.${connector.status}`)}
        </InlineFeedback>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {t('workplace.experience.lastVerified', {
            time: connector.lastVerifiedAt
              ? formatDate(
                  connector.lastVerifiedAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                )
              : t('workplace.experience.neverVerified'),
            version: connector.version,
          })}
        </Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {t('workplace.experience.currentConnector', {
            provider: connector.provider ?? '—',
            reference: connector.configurationReference ?? '—',
          })}
        </Typography>
        <SettingsConfirmation state={state} sourceReady={sourceReady}>
          <Stack spacing={1.5}>
            <FormField
              required
              label={t('workplace.experience.connectorProvider')}
              value={draft.provider}
              inputProps={{ maxLength: 80 }}
              errorMessage={
                draft.provider && !/^[A-Za-z0-9._-]{1,80}$/.test(draft.provider)
                  ? t('workplace.experience.providerFormat')
                  : undefined
              }
              onChange={(event) => setDraft({ ...draft, provider: event.target.value })}
            />
            <FormField
              label={t('workplace.experience.configurationReference')}
              value={draft.configurationReference}
              inputProps={{ maxLength: 160 }}
              errorMessage={
                draft.configurationReference &&
                !/^[A-Za-z0-9._:/-]{1,160}$/.test(draft.configurationReference)
                  ? t('workplace.experience.referenceFormat')
                  : undefined
              }
              supportingText={t('workplace.experience.configurationReferenceHelp')}
              onChange={(event) =>
                setDraft({ ...draft, configurationReference: event.target.value })
              }
            />
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  checked={draft.enabled}
                  onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
                />
              }
              label={t('workplace.experience.connectorEnabled')}
            />
          </Stack>
        </SettingsConfirmation>
      </Stack>
    </GovernancePanel>
  );
}
