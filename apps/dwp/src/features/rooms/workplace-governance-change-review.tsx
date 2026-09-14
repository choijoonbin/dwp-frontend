import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  FormField,
  InlineFeedback,
  foundationTokens,
  PRODUCT_EXPERIENCE_SOFT_OPACITY,
} from '@dwp-frontend/design-system';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, History, RefreshCw } from 'lucide-react';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { WorkplaceGovernanceValueComparison } from './workplace-governance-value-comparison';

import {
  governanceChangeOutcome,
  governanceReviewFingerprint,
  governanceReviewIsCurrent,
  GOVERNANCE_REVIEW_MAX_AGE_MS,
} from './workplace-governance-change-model';

import type {
  WorkplaceGovernanceChangeInput,
  WorkplaceGovernanceChangeReview,
} from '@dwp-frontend/shared-utils';
import type { GovernanceChangeOutcome } from './workplace-governance-change-model';
import type { ReactNode } from 'react';

type ReviewState<T> = {
  fingerprint: string;
  reviewedAt: number;
  data: WorkplaceGovernanceChangeReview<T>;
};
type ReviewOptions<T> = {
  contextKey: string;
  proposed: T;
  canManage: boolean;
  sourceReady: boolean;
  valid: boolean;
  review: (input: WorkplaceGovernanceChangeInput<T>) => Promise<WorkplaceGovernanceChangeReview<T>>;
  apply: (input: WorkplaceGovernanceChangeInput<T>) => Promise<unknown>;
  recheck: () => Promise<boolean>;
  onSaved: () => void | Promise<void>;
};

export function useGovernanceChangeReview<T>({
  contextKey,
  proposed,
  canManage,
  sourceReady,
  valid,
  review,
  apply,
  recheck,
  onSaved,
}: ReviewOptions<T>) {
  const fingerprint = governanceReviewFingerprint(
    JSON.stringify([contextKey, canManage]),
    proposed
  );
  const active = useRef({
    contextKey,
    fingerprint,
    generation: 0,
    mounted: true,
    ready: false,
    canManage,
  });
  active.current.contextKey = contextKey;
  active.current.canManage = canManage;
  if (active.current.fingerprint !== fingerprint) {
    active.current.fingerprint = fingerprint;
    active.current.generation += 1;
  }
  active.current.ready = canManage && sourceReady && valid;
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<'review' | 'save' | 'recheck' | null>(null);
  const [reason, setReason] = useState('');
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ReviewState<T> | null>(null);
  const [outcome, setOutcome] = useState<GovernanceChangeOutcome | null>(null);
  const [saved, setSaved] = useState(false);
  const [rechecked, setRechecked] = useState(false);

  useEffect(() => {
    const instance = active.current;
    instance.mounted = true;
    return () => {
      instance.mounted = false;
      instance.generation += 1;
    };
  }, []);
  useEffect(() => {
    setSnapshot(null);
    setConfirmedKey(null);
  }, [fingerprint]);
  useEffect(() => {
    if (!canManage) {
      setReason('');
      setSnapshot(null);
      setConfirmedKey(null);
    }
  }, [canManage]);
  useEffect(() => {
    if (!snapshot) return undefined;
    const timeout = window.setTimeout(() => {
      setSnapshot(null);
      setConfirmedKey(null);
    }, GOVERNANCE_REVIEW_MAX_AGE_MS);
    return () => window.clearTimeout(timeout);
  }, [snapshot]);

  useEffect(() => {
    if (!sourceReady) {
      setConfirmedKey(null);
      setSnapshot(null);
    }
  }, [sourceReady]);
  useEffect(() => {
    setSaved(false);
    setOutcome(null);
    setReason('');
  }, [contextKey]);
  const currentReview = governanceReviewIsCurrent(snapshot, fingerprint, Date.now())
    ? snapshot?.data
    : undefined;
  const reasonValid = Boolean(reason.trim()) && reason.trim().length <= 500;
  const confirmed = confirmedKey === fingerprint && Boolean(currentReview);
  const ready = canManage && sourceReady && valid && !busy && !saved && !outcome;
  const canSave = ready && confirmed && reasonValid && Boolean(currentReview);

  async function run(kind: 'review' | 'save' | 'recheck') {
    if (
      inFlight.current ||
      !canManage ||
      (kind !== 'recheck' && !ready) ||
      (kind === 'save' && !canSave)
    )
      return;
    const generation = active.current.generation;
    const sameContext = () =>
      active.current.mounted &&
      active.current.contextKey === contextKey &&
      active.current.canManage;
    const current = () => sameContext() && active.current.generation === generation;
    inFlight.current = true;
    setBusy(kind);
    setRechecked(false);
    try {
      if (kind === 'recheck') {
        const refreshed = await recheck();
        if (sameContext() && refreshed) {
          setOutcome(null);
          setSnapshot(null);
          setConfirmedKey(null);
          setRechecked(true);
        }
      } else {
        const input = { proposed, reason: reason.trim(), confirmed: kind === 'save' && confirmed };
        if (kind === 'review') {
          const result = await review(input);
          if (current() && active.current.ready) {
            setSnapshot({ fingerprint, reviewedAt: Date.now(), data: result });
            setConfirmedKey(null);
          }
        } else {
          await apply(input);
          if (current()) {
            setSnapshot(null);
            setConfirmedKey(null);
            await onSaved();
            if (sameContext()) setSaved(true);
          }
        }
      }
    } catch (error) {
      if (current()) {
        const nextOutcome = governanceChangeOutcome(error, kind === 'save');
        setOutcome(nextOutcome);
        if (nextOutcome === 'denied') setReason('');
        setSnapshot(null);
        setConfirmedKey(null);
      }
    } finally {
      inFlight.current = false;
      if (active.current.mounted) setBusy(null);
    }
  }

  return {
    busy,
    reason,
    confirmed,
    currentReview,
    outcome,
    saved,
    rechecked,
    canSave,
    canReview: ready,
    review: () => void run('review'),
    save: () => void run('save'),
    recheck: () => void run('recheck'),
    setReason: (value: string) => {
      setReason(value);
      setConfirmedKey(null);
      setRechecked(false);
    },
    setConfirmed: (value: boolean) => setConfirmedKey(value && currentReview ? fingerprint : null),
  };
}

export type GovernanceReviewRow = { label: string; current: string; proposed: string };

export function WorkplaceGovernanceChangeReview<T>({
  state,
  rows,
  children,
  lead,
  secondary,
  comparisonInRail = false,
  onClose,
  readOnly = false,
}: {
  state: ReturnType<typeof useGovernanceChangeReview<T>>;
  rows: GovernanceReviewRow[];
  children?: ReactNode;
  lead?: ReactNode;
  secondary?: ReactNode;
  comparisonInRail?: boolean;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const navigate = useNavigate();
  const reviewMessage = (value: string) => {
    if (state.currentReview?.targetType !== 'WP_DELEGATION') return value;
    if (value === 'Only the selected delegation and its listed site/actions/validity are changed.')
      return t('workplace.admin.governance.delegation.reviewImpactScope');
    if (value === 'A delegation does not grant Workplace or Rooms application entitlement.')
      return t('workplace.admin.governance.delegation.reviewApplicationAccess');
    if (
      value ===
      'Saved delegation scope is checked on subsequent administrator requests; no external approval or instant cache-propagation guarantee is asserted.'
    )
      return t('workplace.admin.governance.delegation.reviewPropagation');
    return value;
  };
  if (state.outcome === 'denied')
    return (
      <Stack spacing={1.5}>
        <InlineFeedback severity="error">
          {t('workplace.experience.permissionChanged')}
        </InlineFeedback>
        <ActionButton intent="quiet" onClick={onClose}>
          {t('workplace.experience.returnToItem')}
        </ActionButton>
      </Stack>
    );
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.5fr) minmax(280px, .9fr)' },
        gridTemplateAreas: {
          xs: [
            lead && '"lead"',
            '"values"',
            children && '"editor"',
            '"review"',
            secondary && '"secondary"',
          ]
            .filter(Boolean)
            .join(' '),
          lg: comparisonInRail
            ? [
                lead && '"lead values"',
                secondary && '"secondary review"',
                children && '"editor review"',
              ]
                .filter(Boolean)
                .join(' ')
            : [
                lead && '"lead review"',
                secondary && '"secondary review"',
                '"values review"',
                children && '"editor review"',
              ]
                .filter(Boolean)
                .join(' '),
        },
        gap: 2,
        alignItems: 'start',
        minWidth: 0,
      }}
      data-testid="governance-change-review"
    >
      {lead ? <Box sx={{ gridArea: 'lead', minWidth: 0 }}>{lead}</Box> : null}
      <Box sx={{ gridArea: 'values', minWidth: 0 }}>
        <WorkplaceGovernanceValueComparison rows={rows} stacked={comparisonInRail} />
      </Box>
      {children ? <Box sx={{ gridArea: 'editor', minWidth: 0 }}>{children}</Box> : null}
      <Stack
        component="section"
        aria-label={t('workplace.experience.changeReviewRail')}
        spacing={2}
        sx={{
          gridArea: 'review',
          minWidth: 0,
          p: { xs: 1.5, md: 2 },
          border: 1,
          borderColor: 'divider',
          borderTop: 3,
          borderTopColor: 'var(--dwp-product-accent)',
          borderRadius: foundationTokens.radius.control + 'px',
          bgcolor: 'background.paper',
          position: { lg: 'sticky' },
          top: 88,
        }}
      >
        <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
          {t('workplace.experience.changeReviewRail')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.experience.policyChangeCount', {
            count: rows.filter((row) => row.current !== row.proposed).length,
          })}
        </Typography>
        <ActionButton
          intent="secondary"
          startIcon={<ClipboardCheck size={16} />}
          disabled={!state.canReview || readOnly}
          loading={state.busy === 'review'}
          onClick={state.review}
        >
          {t('workplace.experience.reviewChange')}
        </ActionButton>
        {state.currentReview ? (
          <Stack
            spacing={1}
            sx={{
              p: 1.5,
              bgcolor: (theme) => ({
                xs: 'var(--dwp-product-soft)',
                lg: alpha(theme.palette.warning.main, PRODUCT_EXPERIENCE_SOFT_OPACITY),
              }),
              border: 1,
              borderColor: { xs: 'var(--dwp-product-accent)', lg: 'warning.main' },
              borderRadius: foundationTokens.radius.control + 'px',
            }}
          >
            <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
              {t('workplace.experience.knownImpact')}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {state.currentReview.knownImpact.map((value) => (
                <Typography
                  key={value}
                  component="li"
                  variant="body2"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {reviewMessage(value)}
                </Typography>
              ))}
            </Box>
            {state.currentReview.warnings.map((value) => (
              <InlineFeedback key={value} severity="info">
                {reviewMessage(value)}
              </InlineFeedback>
            ))}
            {state.currentReview.currentActorAccess ? (
              <InlineFeedback
                severity={state.currentReview.currentActorAccess.allowed ? 'success' : 'warning'}
              >
                {t(
                  state.currentReview.currentActorAccess.allowed
                    ? 'workplace.experience.currentActorAllowed'
                    : 'workplace.experience.currentActorDenied'
                )}
              </InlineFeedback>
            ) : null}
            {state.currentReview.proposedActorAccess ? (
              <InlineFeedback
                severity={state.currentReview.proposedActorAccess.allowed ? 'success' : 'warning'}
              >
                {t(
                  state.currentReview.proposedActorAccess.allowed
                    ? 'workplace.experience.proposedActorAllowed'
                    : 'workplace.experience.proposedActorDenied'
                )}
              </InlineFeedback>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {t('workplace.experience.reviewedAt', {
                time: formatDate(
                  state.currentReview.evaluatedAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                ),
              })}
            </Typography>
          </Stack>
        ) : (
          <InlineFeedback severity="info">
            {t('workplace.experience.reviewRequired')}
          </InlineFeedback>
        )}
        {readOnly ? (
          <InlineFeedback severity="info">{t('workplace.experience.readOnly')}</InlineFeedback>
        ) : (
          <>
            <FormField
              required
              multiline
              minRows={2}
              label={t('workplace.experience.reason')}
              value={state.reason}
              disabled={Boolean(state.busy) || Boolean(state.outcome) || state.saved}
              inputProps={{ maxLength: 500 }}
              onChange={(event) => state.setReason(event.target.value)}
            />
            <FormControlLabel
              sx={{ m: 0, alignItems: 'flex-start' }}
              control={
                <Checkbox
                  checked={state.confirmed}
                  disabled={
                    !state.currentReview ||
                    Boolean(state.busy) ||
                    Boolean(state.outcome) ||
                    state.saved
                  }
                  onChange={(event) => state.setConfirmed(event.target.checked)}
                />
              }
              label={t('workplace.experience.confirmImpact')}
            />
          </>
        )}
        {state.outcome ? (
          <InlineFeedback
            severity="error"
            action={
              <ActionButton
                intent="secondary"
                loading={state.busy === 'recheck'}
                startIcon={<RefreshCw size={15} />}
                onClick={state.recheck}
              >
                {t('workplace.experience.recheck')}
              </ActionButton>
            }
          >
            {t(
              `workplace.experience.${state.outcome === 'conflict' ? 'conflict' : state.outcome === 'unknown' ? 'changeUnknown' : state.outcome === 'invalid' ? 'invalidChange' : 'reviewUnavailable'}`
            )}
          </InlineFeedback>
        ) : null}
        {state.rechecked ? (
          <InlineFeedback severity="info">
            {t('workplace.experience.originalReloaded')}
          </InlineFeedback>
        ) : null}
        {state.saved ? (
          <InlineFeedback severity="success">
            {t('workplace.experience.changeSaved')}
          </InlineFeedback>
        ) : null}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          {!state.saved && !readOnly ? (
            <ActionButton
              intent="primary"
              disabled={!state.canSave}
              loading={state.busy === 'save'}
              onClick={state.save}
            >
              {t('workplace.experience.saveReviewedChange')}
            </ActionButton>
          ) : null}
          <ActionButton intent="quiet" disabled={Boolean(state.busy)} onClick={onClose}>
            {t('workplace.experience.returnToItem')}
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
      {secondary ? <Box sx={{ gridArea: 'secondary', minWidth: 0 }}>{secondary}</Box> : null}
    </Box>
  );
}
