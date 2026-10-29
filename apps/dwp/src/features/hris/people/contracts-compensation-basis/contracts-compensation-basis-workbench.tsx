import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSignature, RefreshCw, ShieldCheck } from 'lucide-react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DatePickerField,
  foundationTokens,
  GlyphSurface,
  GuidedEmptyState,
  InlineFeedback,
  LocalErrorState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { parseHrisCommandReceipt } from '../command-receipts/model/command-receipt';
import {
  HRM011_ADAPTER_KIND,
  HRM011_FEATURE,
  HRM011_QUERY_CONTRACT,
  assertHrm011TrustedScope,
  createHrm011IssueRequest,
  hrm011ItemCanIssue,
} from './contracts-compensation-basis-contract';
import {
  hrm011ErrorIsConcealed,
  useHrm011WorkbenchQuery,
} from './use-contracts-compensation-basis';

import type { Hrm011QueryAdapter } from './contracts-compensation-basis-api';
import type { HrisCommandReceipt } from '../command-receipts/model/command-receipt';
import type {
  Hrm011FieldDecision,
  Hrm011IssueDraft,
  Hrm011Item,
  Hrm011MetadataValue,
  Hrm011MoneyValue,
  Hrm011TrustedScope,
} from './contracts-compensation-basis-contract';

export type Hrm011RuntimeGate = Readonly<{
  feature: typeof HRM011_FEATURE;
  enabled: boolean;
  tenantEnrolled: boolean;
}>;

export const HRM011_DEFAULT_GATE: Hrm011RuntimeGate = Object.freeze({
  feature: HRM011_FEATURE,
  enabled: false,
  tenantEnrolled: false,
});

export type Hrm011CommandIdentity = Readonly<{
  idempotencyKey: string;
  correlationId: string;
}>;

export type Hrm011IssueDelegate = (draft: Hrm011IssueDraft) => Promise<HrisCommandReceipt>;

export type Hrm011ContractsCompensationBasisWorkbenchProps = Readonly<{
  gate?: Hrm011RuntimeGate;
  /** Trusted read scope supplied only by central PAGE-to-DATA admission. */
  scope?: Hrm011TrustedScope;
  adapter?: Hrm011QueryAdapter;
  initialFocusPublicId?: string;
  onIssueEmploymentContract?: Hrm011IssueDelegate;
  createCommandIdentity?: () => Hrm011CommandIdentity;
}>;

export type Hrm011IssueFailure = Readonly<{
  kind: 'STALE_VERSION' | 'RETRYABLE_UNAVAILABLE' | 'DENIED' | 'CONFLICT' | 'INVALID';
  currentVersion: number | null;
}>;

function currentVersion(details: unknown): number | null {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const value = (details as Record<string, unknown>).currentVersion;
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

export function hrm011IssueFailure(error: unknown): Hrm011IssueFailure {
  if (error instanceof HttpError && error.status === 409) {
    const version = currentVersion(error.details);
    return Object.freeze({
      kind: version === null ? 'CONFLICT' : 'STALE_VERSION',
      currentVersion: version,
    });
  }
  if (
    (error instanceof HttpError && error.status === 503) ||
    (error instanceof HttpTransportError && ['NETWORK', 'TIMEOUT'].includes(error.reason))
  ) {
    return Object.freeze({ kind: 'RETRYABLE_UNAVAILABLE', currentVersion: null });
  }
  if (error instanceof HttpError && [401, 403, 404].includes(error.status)) {
    return Object.freeze({ kind: 'DENIED', currentVersion: null });
  }
  return Object.freeze({ kind: 'INVALID', currentVersion: null });
}

function defaultCommandIdentity(): Hrm011CommandIdentity {
  return Object.freeze({
    idempotencyKey: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
  });
}

function metadata(item: Hrm011Item): Hrm011MetadataValue | null {
  const decision = item.fieldGroups.CONTRACT_METADATA;
  return decision?.decision === 'VIEW' ? (decision.value as Hrm011MetadataValue) : null;
}

function compensation(item: Hrm011Item): Hrm011MoneyValue | null {
  const decision = item.fieldGroups.COMPENSATION_BASIS;
  return decision?.decision === 'VIEW' ? (decision.value as Hrm011MoneyValue) : null;
}

function issueSnapshotIdentity(item: Hrm011Item, locale: string, asOf: string): string {
  return JSON.stringify({
    relationshipPublicId: item.itemPublicId,
    relationshipVersion: item.resourceVersion,
    statusCode: item.statusCode,
    contractMetadata: item.fieldGroups.CONTRACT_METADATA ?? null,
    compensationBasis: item.fieldGroups.COMPENSATION_BASIS ?? null,
    issueAction: item.availableActions[0] ?? null,
    locale,
    asOf,
  });
}

function decisionText(decision: Hrm011FieldDecision | undefined): string {
  if (!decision) return 'Not disclosed';
  if (decision.decision === 'MASK') return 'Restricted by field policy';
  if ('amount' in decision.value) return `${decision.value.amount} ${decision.value.currency}`;
  return `${decision.value.key} · version ${decision.value.version} · immutable snapshot ${
    decision.value.digest === null ? 'unavailable' : 'verified'
  }`;
}

function FieldDecision({
  label,
  decision,
}: Readonly<{ label: string; decision: Hrm011FieldDecision | undefined }>) {
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label.replaceAll('_', ' ')}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight="fontWeightMedium"
        sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {decisionText(decision)}
      </Typography>
    </Box>
  );
}

function IssueContractForm({
  item,
  locale,
  asOf,
  enabled,
  canDelegate,
  onIssueEmploymentContract,
  createCommandIdentity = defaultCommandIdentity,
  refresh,
}: Readonly<{
  item: Hrm011Item;
  locale: string;
  asOf: string;
  enabled: boolean;
  canDelegate: () => boolean;
  onIssueEmploymentContract?: Hrm011IssueDelegate;
  createCommandIdentity?: () => Hrm011CommandIdentity;
  refresh: () => void;
}>) {
  const { t } = useTranslation('workforce');
  const commandFence = useRef(false);
  const completionFence = useRef(false);
  const [effectiveFrom, setEffectiveFrom] = useState(asOf.slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [prepared, setPrepared] = useState<Hrm011IssueDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Hrm011IssueFailure | null>(null);
  const [receipt, setReceipt] = useState<HrisCommandReceipt | null>(null);
  const [blockedVersion, setBlockedVersion] = useState<number | null>(null);
  const contractMetadata = metadata(item);
  const compensationBasis = compensation(item);

  useEffect(() => {
    if (blockedVersion !== null && blockedVersion !== item.resourceVersion) {
      setBlockedVersion(null);
      setFailure(null);
      setPrepared(null);
    }
  }, [blockedVersion, item.resourceVersion]);

  const resetReview = () => {
    if (completionFence.current) return;
    setPrepared(null);
    setFailure(null);
    setReceipt(null);
  };

  const prepare = () => {
    if (
      !enabled ||
      !canDelegate() ||
      completionFence.current ||
      !onIssueEmploymentContract ||
      !hrm011ItemCanIssue(item) ||
      blockedVersion === item.resourceVersion
    ) {
      return;
    }
    try {
      const identity = createCommandIdentity();
      setPrepared(
        Object.freeze({
          sourceItemPublicId: item.itemPublicId,
          action: item.availableActions[0]!,
          request: createHrm011IssueRequest(item, locale, effectiveFrom, effectiveTo || null),
          expectedObjectVersion: item.resourceVersion,
          idempotencyKey: identity.idempotencyKey,
          correlationId: identity.correlationId,
        })
      );
      setFailure(null);
      setReceipt(null);
    } catch {
      setFailure(Object.freeze({ kind: 'INVALID', currentVersion: null }));
    }
  };

  const issue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      commandFence.current ||
      completionFence.current ||
      !prepared ||
      !enabled ||
      !canDelegate() ||
      !onIssueEmploymentContract ||
      blockedVersion === item.resourceVersion
    ) {
      return;
    }
    commandFence.current = true;
    setBusy(true);
    setFailure(null);
    setReceipt(null);
    try {
      const verifiedReceipt = parseHrisCommandReceipt(await onIssueEmploymentContract(prepared));
      if (
        verifiedReceipt.correlationId !== prepared.correlationId ||
        verifiedReceipt.purposeCode !== 'HR_LIFECYCLE'
      ) {
        throw new Error('Employment-contract receipt does not match the prepared command.');
      }
      completionFence.current = true;
      setReceipt(verifiedReceipt);
    } catch (error) {
      const nextFailure = hrm011IssueFailure(error);
      setFailure(nextFailure);
      if (nextFailure.kind === 'STALE_VERSION') setBlockedVersion(item.resourceVersion);
      if (nextFailure.kind !== 'RETRYABLE_UNAVAILABLE') setPrepared(null);
    } finally {
      commandFence.current = false;
      setBusy(false);
    }
  };

  const blocked = blockedVersion === item.resourceVersion;
  const completed = receipt !== null;
  const delegationAvailable = enabled && canDelegate();
  const canPrepare =
    delegationAvailable &&
    Boolean(onIssueEmploymentContract) &&
    hrm011ItemCanIssue(item) &&
    !blocked &&
    !completed;
  return (
    <Box component="form" onSubmit={issue} noValidate sx={{ mt: 2 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
        {t('governedPeople.contracts.issue.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('governedPeople.contracts.issue.description')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
          mt: 2,
        }}
      >
        <DatePickerField
          required
          size="small"
          label={t('governedPeople.contracts.issue.effectiveFrom')}
          value={effectiveFrom || null}
          disabled={!onIssueEmploymentContract || busy || completed || !delegationAvailable}
          onValueChange={(value) => {
            setEffectiveFrom(value ?? '');
            resetReview();
          }}
        />
        <DatePickerField
          size="small"
          label={t('governedPeople.contracts.issue.effectiveTo')}
          value={effectiveTo || null}
          disabled={!onIssueEmploymentContract || busy || completed || !delegationAvailable}
          onValueChange={(value) => {
            setEffectiveTo(value ?? '');
            resetReview();
          }}
        />
      </Box>

      {!prepared ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }}>
          <ActionButton
            type="button"
            intent="primary"
            data-focus-ring="keyboard-visible"
            disabled={!canPrepare || busy}
            onClick={prepare}
            sx={{ minHeight: 44, '&:focus-visible': { outline: '3px solid', outlineOffset: 2 } }}
          >
            {t('governedPeople.contracts.issue.review')}
          </ActionButton>
          {!onIssueEmploymentContract && (
            <Typography variant="caption" color="text.secondary" alignSelf="center">
              {t('governedPeople.contracts.issue.delegateWithheld')}
            </Typography>
          )}
        </Stack>
      ) : (
        <Paper
          component="section"
          aria-label={t('governedPeople.contracts.issue.confirmationAriaLabel')}
          variant="outlined"
          sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover' }}
        >
          <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
            {t('governedPeople.contracts.issue.confirmationTitle')}
          </Typography>
          <Box component="dl" sx={{ m: 0, mt: 1, display: 'grid', gap: 0.75 }}>
            <Typography component="div" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {t('governedPeople.contracts.issue.template', {
                key: contractMetadata?.key,
                version: contractMetadata?.version,
              })}
            </Typography>
            <Typography component="div" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {t('governedPeople.contracts.issue.snapshotDigest', {
                digest: contractMetadata?.digest,
              })}
            </Typography>
            <Typography component="div" variant="body2">
              {t('governedPeople.contracts.issue.compensationBasis', {
                amount: compensationBasis?.amount,
                currency: compensationBasis?.currency,
              })}
            </Typography>
            <Typography component="div" variant="body2">
              {t('governedPeople.contracts.issue.effectivePeriod', {
                effectiveFrom: prepared.request.effectiveFrom,
                effectiveTo:
                  prepared.request.effectiveTo ?? t('governedPeople.contracts.issue.openEnded'),
              })}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.5 }}>
            <ActionButton
              type="submit"
              intent="primary"
              data-focus-ring="keyboard-visible"
              loading={busy}
              disabled={busy || blocked || completed || !delegationAvailable}
              sx={{ minHeight: 44, '&:focus-visible': { outline: '3px solid', outlineOffset: 2 } }}
            >
              {completed
                ? 'Issuance accepted'
                : failure?.kind === 'RETRYABLE_UNAVAILABLE'
                  ? 'Retry same command'
                  : 'Confirm and issue'}
            </ActionButton>
            <ActionButton
              type="button"
              intent="quiet"
              disabled={busy || completed}
              onClick={() => setPrepared(null)}
              sx={{ minHeight: 44 }}
            >
              {t('governedPeople.common.back')}
            </ActionButton>
          </Stack>
        </Paper>
      )}

      {failure?.kind === 'STALE_VERSION' && (
        <InlineFeedback severity="warning" title={t('governedPeople.contracts.failure.staleTitle')}>
          {t('governedPeople.contracts.failure.staleDescription', {
            currentVersion:
              failure.currentVersion === null
                ? ''
                : t('governedPeople.contracts.failure.currentVersion', {
                    version: failure.currentVersion,
                  }),
          })}
          <Box sx={{ mt: 1 }}>
            <ActionButton intent="quiet" size="small" onClick={refresh}>
              {t('governedPeople.contracts.actions.refreshRelationship')}
            </ActionButton>
          </Box>
        </InlineFeedback>
      )}
      {failure?.kind === 'RETRYABLE_UNAVAILABLE' && (
        <InlineFeedback
          severity="warning"
          title={t('governedPeople.contracts.failure.retryableTitle')}
        >
          {t('governedPeople.contracts.failure.retryableDescription')}
        </InlineFeedback>
      )}
      {failure && !['STALE_VERSION', 'RETRYABLE_UNAVAILABLE'].includes(failure.kind) && (
        <InlineFeedback
          severity="error"
          title={t('governedPeople.contracts.failure.notIssuedTitle')}
        >
          {t('governedPeople.contracts.failure.notIssuedDescription')}
        </InlineFeedback>
      )}
      {receipt && (
        <InlineFeedback severity="info" title={t('governedPeople.contracts.receipt.acceptedTitle')}>
          <span role="status" aria-live="polite">
            {t('governedPeople.contracts.receipt.identity', {
              receiptId: receipt.receiptId,
              status: receipt.status,
            })}
          </span>
        </InlineFeedback>
      )}
    </Box>
  );
}

function WorkList({
  items,
  selected,
  onSelect,
}: Readonly<{
  items: readonly Hrm011Item[];
  selected: Hrm011Item;
  onSelect: (item: Hrm011Item) => void;
}>) {
  const { t } = useTranslation('workforce');
  return (
    <Paper component="section" variant="outlined" data-testid="hrm-011-work-list" sx={{ p: 1.25 }}>
      <Typography component="h2" variant="subtitle1" sx={{ px: 0.5, mb: 1 }}>
        {t('governedPeople.contracts.list.title')}
      </Typography>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {items.map((item) => {
          const active = item.itemPublicId === selected.itemPublicId;
          return (
            <Box component="li" key={item.itemPublicId} sx={{ '& + &': { mt: 0.75 } }}>
              <ActionButton
                intent="quiet"
                type="button"
                data-focus-ring="keyboard-visible"
                aria-pressed={active}
                onClick={() => onSelect(item)}
                sx={{
                  width: '100%',
                  minHeight: 48,
                  p: 1.25,
                  border: 1,
                  borderColor: active ? 'primary.main' : 'divider',
                  borderRadius: foundationTokens.radius.control + 'px',
                  bgcolor: active ? 'action.selected' : 'background.paper',
                  color: 'text.primary',
                  display: 'block',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '@media (forced-colors: active)': { borderColor: 'ButtonText' },
                  '&:focus-visible': { outline: '2px solid', outlineOffset: 2 },
                }}
              >
                <Typography
                  component="span"
                  variant="body2"
                  fontWeight="fontWeightBold"
                  display="block"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {item.title}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary">
                  {t('governedPeople.contracts.list.itemIdentity', {
                    status: item.statusCode.replaceAll('_', ' '),
                    version: item.resourceVersion,
                  })}
                </Typography>
              </ActionButton>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

function WorkDetail({
  item,
  scope,
  asOf,
  actionsEnabled,
  canDelegate,
  onIssueEmploymentContract,
  createCommandIdentity,
  refresh,
}: Readonly<{
  item: Hrm011Item;
  scope: Hrm011TrustedScope;
  asOf: string;
  actionsEnabled: boolean;
  canDelegate: () => boolean;
  onIssueEmploymentContract?: Hrm011IssueDelegate;
  createCommandIdentity?: () => Hrm011CommandIdentity;
  refresh: () => void;
}>) {
  const { t } = useTranslation('workforce');
  const deepLink = `${item.deepLink.route}?tab=overview&focus=${encodeURIComponent(
    item.deepLink.resourcePublicId
  )}`;
  return (
    <Paper
      component="section"
      variant="outlined"
      data-testid="hrm-011-work-detail"
      sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
        <Box minWidth={0} flex={1}>
          <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {item.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {item.itemPublicId}
          </Typography>
        </Box>
        <Chip size="small" variant="outlined" label={item.statusCode.replaceAll('_', ' ')} />
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        data-deep-link={deepLink}
        sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}
      >
        {t('governedPeople.contracts.detail.governedReference', { deepLink })}
      </Typography>
      <Divider sx={{ my: 1.5 }} />
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        {HRM011_QUERY_CONTRACT.fieldGroups.map((group) => (
          <FieldDecision key={group} label={group} decision={item.fieldGroups[group]} />
        ))}
      </Box>
      {hrm011ItemCanIssue(item) && (
        <IssueContractForm
          key={issueSnapshotIdentity(item, scope.locale, asOf)}
          item={item}
          locale={scope.locale}
          asOf={asOf}
          enabled={actionsEnabled}
          canDelegate={canDelegate}
          onIssueEmploymentContract={onIssueEmploymentContract}
          createCommandIdentity={createCommandIdentity}
          refresh={refresh}
        />
      )}
    </Paper>
  );
}

function ActiveWorkbench({
  scope,
  adapter,
  initialFocusPublicId,
  onIssueEmploymentContract,
  createCommandIdentity,
}: Readonly<{
  scope: Hrm011TrustedScope;
  adapter: Hrm011QueryAdapter;
  initialFocusPublicId?: string;
  onIssueEmploymentContract?: Hrm011IssueDelegate;
  createCommandIdentity?: () => Hrm011CommandIdentity;
}>) {
  const { t } = useTranslation('workforce');
  const theme = useTheme();
  const compactViewport = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const constrainedWorkflow = useMediaQuery(theme.breakpoints.down('lg'), { noSsr: true });
  const forcedColors = useMediaQuery('(forced-colors: active)', { noSsr: true });
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const query = useHrm011WorkbenchQuery({ adapter, scope });
  const [selectedId, setSelectedId] = useState<string | null>(initialFocusPublicId ?? null);
  const projection = query.projection;

  useEffect(() => {
    if (projection && !projection.items.some((item) => item.itemPublicId === selectedId)) {
      setSelectedId(projection.items[0]?.itemPublicId ?? null);
    }
  }, [projection, selectedId]);

  if (query.loading && !projection) {
    return (
      <Typography role="status" aria-live="polite" data-runtime-state="loading">
        {t('governedPeople.contracts.states.loading')}
      </Typography>
    );
  }
  if (query.error && !projection && hrm011ErrorIsConcealed(query.error)) {
    return (
      <div data-testid="hrm-011-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.contracts.states.deniedTitle')}
          description={t('governedPeople.contracts.states.deniedDescription')}
          size="page"
        />
      </div>
    );
  }
  if (!projection) {
    return (
      <div data-testid="hrm-011-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.contracts.states.unavailableTitle')}
          description={t('governedPeople.contracts.states.unavailableDescription')}
          retryLabel="Retry"
          onRetry={query.refresh}
          retrying={query.fetching}
          size="page"
        />
      </div>
    );
  }
  if (projection.queryState.state === 'UNAVAILABLE') {
    return (
      <div data-testid="hrm-011-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.contracts.states.unavailableTitle')}
          description={t('governedPeople.contracts.states.noDisclosableMetadata')}
          retryLabel="Retry"
          onRetry={query.refresh}
          retrying={query.fetching}
          requestIdLabel={projection.queryState.correlationId}
          size="page"
        />
      </div>
    );
  }

  const selected =
    projection.items.find((item) => item.itemPublicId === selectedId) ??
    projection.items[0] ??
    null;
  const runtimeState = query.stale ? 'stale' : projection.queryState.state.toLowerCase();
  return (
    <Stack
      gap={2}
      data-testid="hrm-011-contracts-compensation-basis"
      data-query-id={HRM011_QUERY_CONTRACT.queryId}
      data-variant={projection.variantKey}
      data-runtime-state={runtimeState}
      data-page-archetype={HRM011_QUERY_CONTRACT.framing.archetype}
      data-layout-density={compactViewport ? 'compact' : 'fluid'}
      data-workflow-layout={constrainedWorkflow ? 'stacked' : 'split'}
      data-color-scheme={theme.palette.mode}
      data-forced-colors={forcedColors ? 'active' : 'inactive'}
      data-reduced-motion={reducedMotion ? 'active' : 'inactive'}
      sx={{
        minWidth: 0,
        maxWidth: '100%',
        '@media (forced-colors: active)': { outline: '1px solid CanvasText', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': {
            animation: 'none !important',
            scrollBehavior: 'auto !important',
            transition: 'none !important',
          },
        },
      }}
    >
      <Paper component="header" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }}>
          <GlyphSurface size={44} variant="soft">
            <FileSignature size={22} aria-hidden="true" />
          </GlyphSurface>
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {t('governedPeople.contracts.header.eyebrow')}
            </Typography>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {t('governedPeople.contracts.header.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('governedPeople.contracts.header.description')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {t('governedPeople.contracts.header.framing', {
                primaryUser: HRM011_QUERY_CONTRACT.framing.primaryUser,
                operationalQuestion: HRM011_QUERY_CONTRACT.framing.operationalQuestion,
              })}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              size="small"
              color={query.stale ? 'warning' : 'success'}
              icon={<ShieldCheck size={14} aria-hidden="true" />}
              label={query.stale ? 'STALE' : projection.queryState.freshness}
            />
            <Chip size="small" variant="outlined" label={`${projection.items.length} items`} />
            <ActionButton
              intent="quiet"
              size="small"
              loading={query.fetching}
              startIcon={<RefreshCw size={15} aria-hidden="true" />}
              onClick={query.refresh}
            >
              {t('governedPeople.common.refresh')}
            </ActionButton>
          </Stack>
        </Stack>
      </Paper>

      {!onIssueEmploymentContract && (
        <InlineFeedback
          severity="info"
          title={t('governedPeople.contracts.states.notAdmittedTitle')}
        >
          {t('governedPeople.contracts.states.notAdmittedDescription')}
        </InlineFeedback>
      )}
      {query.stale && (
        <InlineFeedback severity="warning" title={t('governedPeople.contracts.states.staleTitle')}>
          {t('governedPeople.contracts.states.staleDescription')}
        </InlineFeedback>
      )}
      {projection.queryState.state === 'PARTIAL' && (
        <InlineFeedback
          severity="warning"
          title={t('governedPeople.contracts.states.partialTitle')}
        >
          {t('governedPeople.contracts.states.partialDescription')}
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {projection.queryState.partialFailures.map((failure) => (
              <li key={`${failure.componentKey}:${failure.correlationId}`}>
                {failure.componentKey} · {failure.errorCode}
              </li>
            ))}
          </Box>
        </InlineFeedback>
      )}

      {projection.items.length === 0 ? (
        <GuidedEmptyState
          kind="no-results"
          title={t('governedPeople.contracts.states.emptyTitle')}
          description={t('governedPeople.contracts.states.emptyDescription')}
          size="page"
        />
      ) : selected ? (
        <Box
          data-archetype-composition="list-detail-workflow"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(260px, 340px) minmax(0, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
            minWidth: 0,
          }}
        >
          <WorkList
            items={projection.items}
            selected={selected}
            onSelect={(item) => setSelectedId(item.itemPublicId)}
          />
          <WorkDetail
            item={selected}
            scope={scope}
            asOf={projection.asOf}
            actionsEnabled={query.canDelegate()}
            canDelegate={query.canDelegate}
            onIssueEmploymentContract={onIssueEmploymentContract}
            createCommandIdentity={createCommandIdentity}
            refresh={query.refresh}
          />
        </Box>
      ) : null}

      <Stack direction="row" gap={1} justifyContent="flex-end">
        <ActionButton
          intent="quiet"
          disabled={!query.canPrevious || query.fetching}
          onClick={query.previous}
        >
          {t('governedPeople.common.previous')}
        </ActionButton>
        <ActionButton
          intent="quiet"
          disabled={!query.canNext || query.fetching}
          onClick={query.next}
        >
          {t('governedPeople.common.next')}
        </ActionButton>
      </Stack>
    </Stack>
  );
}

export function Hrm011ContractsCompensationBasisWorkbench({
  gate = HRM011_DEFAULT_GATE,
  scope,
  adapter,
  initialFocusPublicId,
  onIssueEmploymentContract,
  createCommandIdentity,
}: Hrm011ContractsCompensationBasisWorkbenchProps) {
  const { t } = useTranslation('workforce');
  const rolloutAdmitted = gate.feature === HRM011_FEATURE && gate.enabled && gate.tenantEnrolled;
  if (!rolloutAdmitted) {
    return (
      <div data-testid="hrm-011-disabled" data-runtime-state="disabled">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.contracts.states.notEnabledTitle')}
          description={t('governedPeople.contracts.states.notEnabledDescription')}
          size="page"
        />
      </div>
    );
  }
  let trustedScope: Hrm011TrustedScope;
  try {
    trustedScope = assertHrm011TrustedScope(scope);
  } catch {
    return (
      <div data-testid="hrm-011-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.contracts.states.deniedTitle')}
          description={t('governedPeople.contracts.states.deniedDescription')}
          size="page"
        />
      </div>
    );
  }
  if (!adapter || adapter.kind !== HRM011_ADAPTER_KIND) {
    return (
      <div data-testid="hrm-011-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.contracts.states.unavailableTitle')}
          description={t('governedPeople.contracts.states.adapterNotMounted')}
          size="page"
        />
      </div>
    );
  }
  const runtimeIdentity = JSON.stringify([trustedScope, adapter.kind]);
  return (
    <ActiveWorkbench
      key={runtimeIdentity}
      scope={trustedScope}
      adapter={adapter}
      initialFocusPublicId={initialFocusPublicId}
      onIssueEmploymentContract={onIssueEmploymentContract}
      createCommandIdentity={createCommandIdentity}
    />
  );
}
