import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  GlyphSurface,
  GuidedEmptyState,
  InlineFeedback,
  LocalErrorState,
  FormField,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  HRM009_ADAPTER_KIND,
  HRM009_FEATURE,
  HRM009_QUERY_CONTRACTS,
  assertHrm009CertificateRequest,
  assertHrm009TrustedScope,
  hasHrm009RequestCertificateAction,
} from './certificate-contract';
import { hrm009ErrorIsConcealed, useHrm009WorkbenchQuery } from './use-certificate-workbench';

import type { Hrm009QueryAdapter } from './certificate-api';
import type {
  Hrm009FieldDecision,
  Hrm009FieldValue,
  Hrm009Item,
  Hrm009QueryId,
  Hrm009RequestCertificateDraft,
  Hrm009RequestCertificateResult,
  Hrm009TrustedScope,
} from './certificate-contract';

export type Hrm009RuntimeGate = Readonly<{
  feature: typeof HRM009_FEATURE;
  enabled: boolean;
  tenantEnrolled: boolean;
}>;

export const HRM009_DEFAULT_GATE: Hrm009RuntimeGate = Object.freeze({
  feature: HRM009_FEATURE,
  enabled: false,
  tenantEnrolled: false,
});

export type Hrm009RequestCertificateDelegate = (
  draft: Hrm009RequestCertificateDraft
) => Promise<Hrm009RequestCertificateResult> | Hrm009RequestCertificateResult;

export type Hrm009CertificateWorkbenchProps = Readonly<{
  queryId: Hrm009QueryId;
  gate?: Hrm009RuntimeGate;
  /** Trusted read scope supplied only by the central PAGE-to-DATA admission. */
  scope?: Hrm009TrustedScope;
  /** Read-only owner GET adapter; the central mount keeps every ACTION delegate withheld. */
  adapter?: Hrm009QueryAdapter;
  /** Optional deep-link focus selected only after the read projection passes its sealed parser. */
  initialFocusPublicId?: string;
  defaultPersonPublicId?: string;
  onRequestCertificate?: Hrm009RequestCertificateDelegate;
}>;

type SurfaceCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  listTitle: string;
  emptyTitle: string;
  emptyDescription: string;
}>;

const SURFACE_COPY: Readonly<Record<Hrm009QueryId, SurfaceCopy>> = Object.freeze({
  'IAQ-003': Object.freeze({
    eyebrow: 'Employee self-service · governed requests',
    title: 'My HR requests and certificates',
    description:
      'Review disclosed request and certificate metadata in the current read-only Stage-A scope.',
    listTitle: 'My disclosed requests',
    emptyTitle: 'No disclosed requests',
    emptyDescription: 'No request metadata is available in this governed self-service scope.',
  }),
  'IAQ-010': Object.freeze({
    eyebrow: 'HR operations · governed certificate metadata',
    title: 'Certificates and documents',
    description:
      'Inspect certificate metadata for the authorized population in the current read-only Stage-A scope.',
    listTitle: 'Certificate metadata requiring review',
    emptyTitle: 'No disclosed certificate metadata',
    emptyDescription: 'No certificate metadata is available in this governed operations scope.',
  }),
});

function valueText(value: Hrm009FieldValue): string {
  if ('itemCount' in value) return `${value.itemCount} items · revision ${value.revision}`;
  if ('receiptId' in value) {
    return `${value.state} · ${value.occurredAt} · revision ${value.revision}`;
  }
  if ('key' in value) {
    return `${value.key} · version ${value.version} · digest ${
      value.digest === null ? 'not recorded' : 'recorded'
    }`;
  }
  return `${value.code} · revision ${value.revision}`;
}

function FieldDecision({
  label,
  decision,
}: Readonly<{ label: string; decision: Hrm009FieldDecision | undefined }>) {
  const display = !decision
    ? 'Not disclosed'
    : decision.decision === 'MASK'
      ? 'Restricted by field policy'
      : valueText(decision.value);
  return (
    <Box component="div" sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label.replaceAll('_', ' ')}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight="subtitle2.fontWeight"
        sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}
      >
        {display}
      </Typography>
    </Box>
  );
}

function CertificateRequestForm({
  queryId,
  item,
  locale,
  asOf,
  defaultPersonPublicId,
  enabled,
  canDelegate,
  onRequestCertificate,
}: Readonly<{
  queryId: Hrm009QueryId;
  item: Hrm009Item;
  locale: string;
  asOf: string;
  defaultPersonPublicId?: string;
  enabled: boolean;
  canDelegate: () => boolean;
  onRequestCertificate?: Hrm009RequestCertificateDelegate;
}>) {
  const { t } = useTranslation('workforce');
  const contract = HRM009_QUERY_CONTRACTS[queryId];
  const commandFence = useRef(false);
  const [personPublicId, setPersonPublicId] = useState(defaultPersonPublicId ?? '');
  const [certificateType, setCertificateType] = useState('EMPLOYMENT_CERTIFICATE');
  const [requestAsOf, setRequestAsOf] = useState(asOf);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [receipt, setReceipt] = useState<Exclude<Hrm009RequestCertificateResult, void> | null>(
    null
  );
  const purposeCode = contract.purpose;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      commandFence.current ||
      !enabled ||
      !canDelegate() ||
      !onRequestCertificate ||
      !hasHrm009RequestCertificateAction(item)
    ) {
      return;
    }
    commandFence.current = true;
    setBusy(true);
    setError(false);
    setReceipt(null);
    try {
      const request = assertHrm009CertificateRequest({
        personPublicId,
        certificateType,
        purposeCode,
        locale,
        asOf: requestAsOf,
      });
      const result = await onRequestCertificate({
        sourceQueryId: queryId,
        sourceItemPublicId: item.itemPublicId,
        request,
      });
      if (result) setReceipt(result);
    } catch {
      setError(true);
    } finally {
      commandFence.current = false;
      setBusy(false);
    }
  };

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ mt: 2 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
        {contract.framing.primaryAction}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('governedPeople.certificates.request.purpose', { purposeCode })}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
          mt: 2,
          minWidth: 0,
        }}
      >
        <FormField
          required
          fullWidth
          size="small"
          label={t('governedPeople.certificates.request.personPublicId')}
          value={personPublicId}
          disabled={!onRequestCertificate}
          onChange={(event) => setPersonPublicId(event.target.value)}
          inputProps={{ autoComplete: 'off', spellCheck: false }}
        />
        <FormField
          required
          select
          fullWidth
          size="small"
          label={t('governedPeople.certificates.request.certificateType')}
          value={certificateType}
          disabled={!onRequestCertificate}
          onChange={(event) => setCertificateType(event.target.value)}
        >
          <MenuItem value="EMPLOYMENT_CERTIFICATE">
            {t('governedPeople.certificates.request.types.employment')}
          </MenuItem>
          <MenuItem value="CAREER_CERTIFICATE">
            {t('governedPeople.certificates.request.types.career')}
          </MenuItem>
          <MenuItem value="INCOME_CERTIFICATE">
            {t('governedPeople.certificates.request.types.income')}
          </MenuItem>
        </FormField>
        <FormField
          required
          fullWidth
          size="small"
          label={t('governedPeople.certificates.request.asOf')}
          value={requestAsOf}
          disabled={!onRequestCertificate}
          onChange={(event) => setRequestAsOf(event.target.value)}
          inputProps={{ autoComplete: 'off', spellCheck: false }}
          sx={{ gridColumn: { sm: '1 / -1' } }}
        />
      </Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        sx={{ mt: 2 }}
        alignItems={{ sm: 'center' }}
      >
        <ActionButton
          type="submit"
          intent="primary"
          loading={busy}
          disabled={!enabled || !onRequestCertificate || busy}
          sx={{
            minHeight: 44,
            '&:focus-visible': {
              outline: '3px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          {t('governedPeople.certificates.request.reviewAndSend')}
        </ActionButton>
        {!onRequestCertificate && (
          <Typography variant="caption" color="text.secondary">
            {t('governedPeople.certificates.request.delegateWithheld')}
          </Typography>
        )}
      </Stack>
      {error && (
        <InlineFeedback
          severity="error"
          title={t('governedPeople.certificates.request.notAcceptedTitle')}
        >
          {t('governedPeople.certificates.request.notAcceptedDescription')}
        </InlineFeedback>
      )}
      {receipt && (
        <InlineFeedback
          severity="info"
          title={t('governedPeople.certificates.request.receiptAcceptedTitle')}
        >
          <span role="status" aria-live="polite">
            {t('governedPeople.certificates.request.receipt', {
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
  queryId,
  items,
  selected,
  onSelect,
}: Readonly<{
  queryId: Hrm009QueryId;
  items: readonly Hrm009Item[];
  selected: Hrm009Item;
  onSelect: (item: Hrm009Item) => void;
}>) {
  return (
    <Paper
      component="section"
      variant="outlined"
      data-testid="hrm-009-work-list"
      sx={{ p: 1.25, minWidth: 0 }}
    >
      <Typography component="h2" variant="subtitle1" sx={{ px: 0.5, mb: 1 }}>
        {SURFACE_COPY[queryId].listTitle}
      </Typography>
      <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {items.map((item) => {
          const active = item.itemPublicId === selected.itemPublicId;
          return (
            <Box component="li" key={item.itemPublicId} sx={{ '& + &': { mt: 0.75 } }}>
              <Box
                component="button"
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(item)}
                sx={{
                  width: '100%',
                  minHeight: 48,
                  p: 1.25,
                  border: 1,
                  borderColor: active ? 'primary.main' : 'divider',
                  borderRadius: foundationTokens.radius.surface + 'px',
                  bgcolor: active ? 'action.selected' : 'background.paper',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '@media (forced-colors: active)': { borderColor: 'ButtonText' },
                  '@media (prefers-reduced-motion: reduce)': { scrollBehavior: 'auto' },
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
                  {item.statusCode.replaceAll('_', ' ')}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

function WorkDetail({
  queryId,
  item,
  scope,
  asOf,
  actionsEnabled,
  canDelegate,
  defaultPersonPublicId,
  onRequestCertificate,
}: Readonly<{
  queryId: Hrm009QueryId;
  item: Hrm009Item;
  scope: Hrm009TrustedScope;
  asOf: string;
  actionsEnabled: boolean;
  canDelegate: () => boolean;
  defaultPersonPublicId?: string;
  onRequestCertificate?: Hrm009RequestCertificateDelegate;
}>) {
  const { t } = useTranslation('workforce');
  const contract = HRM009_QUERY_CONTRACTS[queryId];
  const deepLink = `${item.deepLink.route}?tab=overview&focus=${encodeURIComponent(
    item.deepLink.resourcePublicId
  )}`;
  return (
    <Paper
      component="section"
      variant="outlined"
      data-testid="hrm-009-work-detail"
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
        {t('governedPeople.certificates.detail.governedReference', { deepLink })}
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
        {contract.fieldGroups.map((group) => (
          <FieldDecision key={group} label={group} decision={item.fieldGroups[group]} />
        ))}
      </Box>
      {hasHrm009RequestCertificateAction(item) && (
        <CertificateRequestForm
          key={`${queryId}:${item.itemPublicId}`}
          queryId={queryId}
          item={item}
          locale={scope.locale}
          asOf={asOf}
          defaultPersonPublicId={defaultPersonPublicId}
          enabled={actionsEnabled}
          canDelegate={canDelegate}
          onRequestCertificate={onRequestCertificate}
        />
      )}
    </Paper>
  );
}

function OperationsFocusForm({
  items,
  item,
  onSelect,
  scope,
  asOf,
  actionsEnabled,
  canDelegate,
  defaultPersonPublicId,
  onRequestCertificate,
}: Readonly<{
  items: readonly Hrm009Item[];
  item: Hrm009Item;
  onSelect: (item: Hrm009Item) => void;
  scope: Hrm009TrustedScope;
  asOf: string;
  actionsEnabled: boolean;
  canDelegate: () => boolean;
  defaultPersonPublicId?: string;
  onRequestCertificate?: Hrm009RequestCertificateDelegate;
}>) {
  const { t } = useTranslation('workforce');
  const contract = HRM009_QUERY_CONTRACTS['IAQ-010'];
  const deepLink = `${item.deepLink.route}?tab=overview&focus=${encodeURIComponent(
    item.deepLink.resourcePublicId
  )}`;
  return (
    <Paper
      component="section"
      variant="outlined"
      data-testid="hrm-009-operations-focus-form"
      data-archetype-composition="focus-form"
      sx={{ width: '100%', maxWidth: 920, mx: 'auto', p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}
    >
      <Stack gap={2}>
        <Box minWidth={0}>
          <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {t('governedPeople.certificates.focus.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('governedPeople.certificates.focus.description')}
          </Typography>
        </Box>

        <FormField
          select
          fullWidth
          size="small"
          label={t('governedPeople.certificates.focus.fieldLabel')}
          value={item.itemPublicId}
          onChange={(event) => {
            const selected = items.find(
              (candidate) => candidate.itemPublicId === event.target.value
            );
            if (selected) onSelect(selected);
          }}
        >
          {items.map((candidate) => (
            <MenuItem key={candidate.itemPublicId} value={candidate.itemPublicId}>
              {candidate.title}
            </MenuItem>
          ))}
        </FormField>

        <Box
          component="section"
          aria-label={t('governedPeople.certificates.focus.selectedAriaLabel')}
          sx={{
            bgcolor: 'action.hover',
            borderRadius: foundationTokens.radius.surface + 'px',
            p: { xs: 1.25, sm: 1.75 },
            minWidth: 0,
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
            <Box minWidth={0} flex={1}>
              <Typography
                component="h3"
                variant="subtitle1"
                fontWeight="fontWeightBold"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
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
            {t('governedPeople.certificates.detail.governedReference', { deepLink })}
          </Typography>
          <Box
            component="dl"
            sx={{
              m: 0,
              mt: 1.5,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {contract.fieldGroups.map((group) => (
              <FieldDecision key={group} label={group} decision={item.fieldGroups[group]} />
            ))}
          </Box>
        </Box>

        {hasHrm009RequestCertificateAction(item) && (
          <CertificateRequestForm
            key={`IAQ-010:${item.itemPublicId}`}
            queryId="IAQ-010"
            item={item}
            locale={scope.locale}
            asOf={asOf}
            defaultPersonPublicId={defaultPersonPublicId}
            enabled={actionsEnabled}
            canDelegate={canDelegate}
            onRequestCertificate={onRequestCertificate}
          />
        )}
      </Stack>
    </Paper>
  );
}

function ActiveCertificateWorkbench({
  queryId,
  scope,
  adapter,
  initialFocusPublicId,
  defaultPersonPublicId,
  onRequestCertificate,
}: Readonly<{
  queryId: Hrm009QueryId;
  scope: Hrm009TrustedScope;
  adapter: Hrm009QueryAdapter;
  initialFocusPublicId?: string;
  defaultPersonPublicId?: string;
  onRequestCertificate?: Hrm009RequestCertificateDelegate;
}>) {
  const { t } = useTranslation('workforce');
  const theme = useTheme();
  const compactViewport = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const forcedColors = useMediaQuery('(forced-colors: active)', { noSsr: true });
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const query = useHrm009WorkbenchQuery({ adapter, queryId, scope });
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
        {t('governedPeople.certificates.states.loading')}
      </Typography>
    );
  }
  if (query.error && !projection && hrm009ErrorIsConcealed(query.error)) {
    return (
      <div data-testid="hrm-009-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.certificates.states.deniedTitle')}
          description={t('governedPeople.certificates.states.deniedDescription')}
          size="page"
        />
      </div>
    );
  }
  if (!projection) {
    return (
      <div data-testid="hrm-009-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.certificates.states.unavailableTitle')}
          description={t('governedPeople.certificates.states.unavailableDescription')}
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
      <div data-testid="hrm-009-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.certificates.states.unavailableTitle')}
          description={t('governedPeople.certificates.states.noDisclosableMetadata')}
          retryLabel="Retry"
          onRetry={query.refresh}
          retrying={query.fetching}
          requestIdLabel={projection.queryState.correlationId}
          size="page"
        />
      </div>
    );
  }

  const contract = HRM009_QUERY_CONTRACTS[queryId];
  const copy = SURFACE_COPY[queryId];
  const selected =
    projection.items.find((item) => item.itemPublicId === selectedId) ??
    projection.items[0] ??
    null;
  const actionsEnabled = query.canDelegate();
  const runtimeState = query.stale ? 'stale' : projection.queryState.state.toLowerCase();
  return (
    <Stack
      gap={2}
      data-testid="hrm-009-certificate-workbench"
      data-query-id={queryId}
      data-variant={projection.variantKey}
      data-runtime-state={runtimeState}
      data-page-archetype={contract.framing.archetype}
      data-layout-density={compactViewport ? 'compact' : 'fluid'}
      data-color-scheme={theme.palette.mode}
      data-forced-colors={forcedColors ? 'active' : 'inactive'}
      data-reduced-motion={reducedMotion ? 'active' : 'inactive'}
      sx={{
        minWidth: 0,
        maxWidth: '100%',
        '@media (forced-colors: active)': {
          outline: '1px solid CanvasText',
          outlineOffset: 2,
        },
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
            {queryId === 'IAQ-003' ? (
              <FileCheck2 size={22} aria-hidden="true" />
            ) : (
              <ShieldCheck size={22} aria-hidden="true" />
            )}
          </GlyphSurface>
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.eyebrow}
            </Typography>
            <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
              {copy.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.description}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {t('governedPeople.certificates.header.framing', {
                primaryUser: contract.framing.primaryUser,
                operationalQuestion: contract.framing.operationalQuestion,
                archetype: contract.framing.archetype,
              })}
            </Typography>
          </Box>
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip
              size="small"
              color={query.stale ? 'warning' : 'success'}
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

      {!onRequestCertificate && (
        <InlineFeedback
          severity="info"
          title={t('governedPeople.certificates.states.readOnlyTitle')}
        >
          {t('governedPeople.certificates.states.readOnlyDescription')}
        </InlineFeedback>
      )}

      {query.stale && (
        <InlineFeedback
          severity="warning"
          title={t('governedPeople.certificates.states.staleTitle')}
        >
          {t('governedPeople.certificates.states.staleDescription')}
        </InlineFeedback>
      )}
      {projection.queryState.state === 'PARTIAL' && (
        <InlineFeedback
          severity="warning"
          title={t('governedPeople.certificates.states.partialTitle')}
        >
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
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          size="page"
        />
      ) : selected && queryId === 'IAQ-003' ? (
        <Box
          data-archetype-composition="list-detail"
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
            queryId="IAQ-003"
            items={projection.items}
            selected={selected}
            onSelect={(item) => setSelectedId(item.itemPublicId)}
          />
          <WorkDetail
            queryId="IAQ-003"
            item={selected}
            scope={scope}
            asOf={projection.asOf}
            actionsEnabled={actionsEnabled}
            canDelegate={query.canDelegate}
            defaultPersonPublicId={defaultPersonPublicId}
            onRequestCertificate={onRequestCertificate}
          />
        </Box>
      ) : selected ? (
        <OperationsFocusForm
          items={projection.items}
          item={selected}
          onSelect={(item) => setSelectedId(item.itemPublicId)}
          scope={scope}
          asOf={projection.asOf}
          actionsEnabled={actionsEnabled}
          canDelegate={query.canDelegate}
          defaultPersonPublicId={defaultPersonPublicId}
          onRequestCertificate={onRequestCertificate}
        />
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

export function Hrm009CertificateWorkbench({
  queryId,
  gate = HRM009_DEFAULT_GATE,
  scope,
  adapter,
  initialFocusPublicId,
  defaultPersonPublicId,
  onRequestCertificate,
}: Hrm009CertificateWorkbenchProps) {
  const { t } = useTranslation('workforce');
  const rolloutAdmitted = gate.feature === HRM009_FEATURE && gate.enabled && gate.tenantEnrolled;
  if (!rolloutAdmitted) {
    return (
      <div data-testid="hrm-009-disabled" data-runtime-state="disabled">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.certificates.states.notEnabledTitle')}
          description={t('governedPeople.certificates.states.notEnabledDescription')}
          size="page"
        />
      </div>
    );
  }
  let trustedScope: Hrm009TrustedScope;
  try {
    trustedScope = assertHrm009TrustedScope(scope);
  } catch {
    return (
      <div data-testid="hrm-009-denied" data-runtime-state="denied">
        <GuidedEmptyState
          kind="permission"
          title={t('governedPeople.certificates.states.deniedTitle')}
          description={t('governedPeople.certificates.states.deniedDescription')}
          size="page"
        />
      </div>
    );
  }
  if (!adapter || adapter.kind !== HRM009_ADAPTER_KIND) {
    return (
      <div data-testid="hrm-009-unavailable" data-runtime-state="unavailable">
        <LocalErrorState
          title={t('governedPeople.certificates.states.unavailableTitle')}
          description={t('governedPeople.certificates.states.adapterNotMounted')}
          size="page"
        />
      </div>
    );
  }
  const runtimeIdentity = JSON.stringify([queryId, trustedScope, adapter.kind]);
  return (
    <ActiveCertificateWorkbench
      key={runtimeIdentity}
      queryId={queryId}
      scope={trustedScope}
      adapter={adapter}
      initialFocusPublicId={initialFocusPublicId}
      defaultPersonPublicId={defaultPersonPublicId}
      onRequestCertificate={onRequestCertificate}
    />
  );
}

type SurfaceProps = Omit<Hrm009CertificateWorkbenchProps, 'queryId'>;

export function Hrm009SelfServiceRequestsSurface(props: SurfaceProps) {
  return <Hrm009CertificateWorkbench {...props} queryId="IAQ-003" />;
}

export function Hrm009OperationsCertificatesSurface(props: SurfaceProps) {
  return <Hrm009CertificateWorkbench {...props} queryId="IAQ-010" />;
}
