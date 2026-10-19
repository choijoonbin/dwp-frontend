import { useState } from 'react';
import {
  ActionButton,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY,
  STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY,
  STATUTORY_INSURANCE_DEFAULT_ROLLOUT,
  STATUTORY_INSURANCE_FEATURE,
  statutoryInsuranceEnabledForTenant,
} from './statutory-insurance-contract';
import { statutoryInsuranceCopy } from './statutory-insurance-copy';
import {
  useSocialInsuranceWorkbench,
  useStatutoryConfigurationWorkbench,
} from './use-statutory-insurance-workbenches';

import type { FormEvent, ReactNode } from 'react';
import type { StatutoryInsuranceDataSource } from './statutory-insurance-api';
import type {
  CountryPackActivationRequest,
  FieldDecision,
  SocialInsuranceItem,
  StatutoryConfigurationItem,
  StatutoryInsuranceRollout,
} from './statutory-insurance-contract';
import type {
  SocialInsuranceController,
  SocialInsuranceOwnerBinding,
  StatutoryConfigurationController,
  StatutoryConfigurationOwnerBinding,
  StatutoryInsuranceScope,
  WorkbenchRuntimeState,
} from './use-statutory-insurance-workbenches';

const EMPTY_ACTIVATION: CountryPackActivationRequest = Object.freeze({
  officialReferenceSet: '',
  effectiveDate: '',
  goldenPackDigest: '',
  statutoryApprovalReceiptId: '',
});

export const STATUTORY_INSURANCE_RESPONSIVE_CONTRACT = Object.freeze({
  verifiedDesktopWidths: Object.freeze([1440, 1280] as const),
  verifiedCompactWidths: Object.freeze([390, 320] as const),
  primarySplitMinCssPixels: 1200,
  verifiedZoomPercent: 200,
});

export type StatutoryInsuranceTrustedAdmission = Readonly<{
  kind: 'TRUSTED_PRODUCT_SURFACE_PAGE';
  feature: typeof STATUTORY_INSURANCE_FEATURE;
  pageRouteContractKey:
    | typeof STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY
    | typeof SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY;
  tenantId: string;
  contextKey: string;
  contextScopeKey: string;
  decisionRevision: string;
}>;

export function statutoryInsurancePrimaryLayoutAtViewport(
  viewportWidth: number,
  zoomPercent = 100
): 'SPLIT' | 'STACKED' {
  const cssPixelWidth = viewportWidth / (zoomPercent / 100);
  return cssPixelWidth >= STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.primarySplitMinCssPixels
    ? 'SPLIT'
    : 'STACKED';
}

function primaryGridStyles() {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    [`@media (min-width: ${STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.primarySplitMinCssPixels}px)`]: {
      gridTemplateColumns: 'minmax(240px, 2fr) minmax(0, 3fr)',
    },
    gap: 2,
    alignItems: 'start',
    minWidth: 0,
  } as const;
}

type LoadedState<T> = Extract<
  WorkbenchRuntimeState<T>,
  { kind: 'EMPTY' | 'PARTIAL' | 'STALE' | 'COMPLETE' }
>;
type ProjectionWithFreshness = Readonly<{
  queryState: Readonly<{ freshness: 'CURRENT' | 'STALE' | 'UNAVAILABLE' }>;
}>;

function admittedScope(
  admission: StatutoryInsuranceTrustedAdmission | undefined,
  rollout: StatutoryInsuranceRollout,
  routeContractKey:
    | typeof STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY
    | typeof SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY
): StatutoryInsuranceScope | null {
  if (
    !admission ||
    admission.kind !== 'TRUSTED_PRODUCT_SURFACE_PAGE' ||
    admission.feature !== STATUTORY_INSURANCE_FEATURE ||
    admission.pageRouteContractKey !== routeContractKey ||
    !admission.tenantId.trim() ||
    !admission.contextKey.trim() ||
    !admission.contextScopeKey.trim() ||
    !admission.decisionRevision.trim() ||
    !statutoryInsuranceEnabledForTenant(rollout, admission.tenantId)
  ) {
    return null;
  }
  return Object.freeze({
    ready: true,
    tenantId: admission.tenantId,
    contextKey: admission.contextKey,
    contextScopeKey: admission.contextScopeKey,
    decisionRevision: admission.decisionRevision,
  });
}

function shellStyles() {
  return {
    minWidth: 0,
    '@media (prefers-reduced-motion: reduce)': {
      '&, & *': { animation: 'none !important', transition: 'none !important' },
    },
    '@media (forced-colors: active)': {
      '& .MuiPaper-outlined': { borderColor: 'CanvasText' },
      '& .MuiButton-root:focus-visible': { outline: '2px solid CanvasText' },
    },
  } as const;
}

function SurfaceHeader<T extends ProjectionWithFreshness>({
  eyebrow,
  title,
  description,
  loaded,
}: {
  eyebrow: string;
  title: string;
  description: string;
  loaded: LoadedState<T> | null;
}) {
  return (
    <Box component="header" minWidth={0}>
      <Typography variant="overline" color="text.secondary">
        {eyebrow}
      </Typography>
      <Typography component="h1" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 840 }}>
        {description}
      </Typography>
      {loaded && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75} sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            color={loaded.projection.queryState.freshness === 'CURRENT' ? 'success' : 'warning'}
            label={
              loaded.projection.queryState.freshness === 'CURRENT'
                ? statutoryInsuranceCopy.common.current
                : statutoryInsuranceCopy.common.stale
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { sm: 'center' } }}>
            {statutoryInsuranceCopy.common.lastRefresh}: {new Date(loaded.loadedAt).toISOString()}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

function ClosedSurface({ settings }: { settings: boolean }) {
  const copy = settings ? statutoryInsuranceCopy.settings : statutoryInsuranceCopy.operations;
  return (
    <Stack
      data-slice="BASE-TFR-PAY-003"
      data-runtime-state="closed"
      data-testid={settings ? 'pay003-settings-workbench' : 'pay003-operations-workbench'}
      gap={2}
      sx={shellStyles()}
    >
      <SurfaceHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        loaded={null}
      />
      <GuidedEmptyState
        kind="permission"
        size="page"
        title={copy.closedTitle}
        description={copy.closedDescription}
      />
    </Stack>
  );
}

function EvidenceField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box component="div" minWidth={0}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function visible<T>(decision: FieldDecision<T> | undefined) {
  return decision?.decision === 'VIEW' ? decision.value : null;
}

function hidden<T>(decision: FieldDecision<T> | undefined) {
  return decision?.decision === 'MASK'
    ? statutoryInsuranceCopy.settings.masked
    : statutoryInsuranceCopy.settings.omitted;
}

function FailureList({
  failures,
  titleId,
}: {
  failures: readonly { componentKey: string; errorCode: string }[];
  titleId: string;
}) {
  if (failures.length === 0) return null;
  return (
    <Box component="section" aria-labelledby={titleId}>
      <Typography id={titleId} component="h3" variant="subtitle2">
        {statutoryInsuranceCopy.common.partialFailures}
      </Typography>
      <Stack component="ul" gap={0.5} sx={{ mt: 0.75, mb: 0, pl: 2.5 }}>
        {failures.map((failure) => (
          <Typography
            component="li"
            variant="body2"
            key={`${failure.componentKey}:${failure.errorCode}`}
          >
            {failure.componentKey} · {failure.errorCode}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

function ProjectionFeedback({
  state,
  settings,
}: {
  state: WorkbenchRuntimeState<unknown>;
  settings: boolean;
}) {
  const copy = settings ? statutoryInsuranceCopy.settings : statutoryInsuranceCopy.operations;
  if (state.kind === 'PARTIAL') {
    return (
      <InlineFeedback severity="warning" title={copy.partialTitle}>
        {copy.partialDescription}
      </InlineFeedback>
    );
  }
  if (state.kind === 'STALE') {
    return (
      <InlineFeedback severity="warning" title={copy.staleTitle}>
        {copy.staleDescription}
      </InlineFeedback>
    );
  }
  if (state.kind === 'COMPLETE') {
    return (
      <InlineFeedback severity="success" title={copy.completeTitle}>
        {copy.completeDescription}
      </InlineFeedback>
    );
  }
  return null;
}

function SettingsActivationFeedback({
  controller,
}: {
  controller: StatutoryConfigurationController;
}) {
  const copy = statutoryInsuranceCopy.settings;
  const feedback = controller.feedback;
  if (!feedback) return null;
  if (feedback.kind === 'STEP_UP') {
    return (
      <InlineFeedback severity="info" title={copy.stepUpTitle}>
        {copy.stepUpDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'ACCEPTED' || feedback.kind === 'SUCCEEDED') {
    return (
      <InlineFeedback
        severity="success"
        title={feedback.kind === 'SUCCEEDED' ? copy.succeededTitle : copy.acceptedTitle}
      >
        {feedback.receipt.receiptId}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'RESULT_UNKNOWN') {
    return (
      <InlineFeedback
        severity="warning"
        title={copy.resultUnknownTitle}
        action={
          <ActionButton
            intent="secondary"
            size="small"
            disabled={controller.busy || !controller.hasPendingExactRetry}
            onClick={() => void controller.retryExactActivation()}
          >
            {copy.retryExact}
          </ActionButton>
        }
      >
        {copy.resultUnknownDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'CONFLICT') {
    return (
      <InlineFeedback severity="warning" title={copy.conflictTitle}>
        {copy.conflictDescription}
      </InlineFeedback>
    );
  }
  if (feedback.kind === 'FORBIDDEN') {
    return (
      <InlineFeedback severity="error" title={copy.forbiddenCommandTitle}>
        {copy.forbiddenCommandDescription}
      </InlineFeedback>
    );
  }
  return (
    <InlineFeedback severity="error" title={copy.rejectedTitle}>
      {feedback.kind === 'INVALID' ? feedback.message : undefined}
    </InlineFeedback>
  );
}

function ReviewForm({
  question,
  action,
  loading,
  onReview,
}: {
  question: string;
  action: string;
  loading: boolean;
  onReview: (effectiveOn: string) => void;
}) {
  const [effectiveOn, setEffectiveOn] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onReview(effectiveOn);
  }
  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack gap={1.5}>
        <Typography component="h2" variant="h6">
          {question}
        </Typography>
        <Box component="form" onSubmit={submit} noValidate>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <TextField
              fullWidth
              size="small"
              type="date"
              label={`${statutoryInsuranceCopy.common.effectiveOn} (${statutoryInsuranceCopy.common.optional})`}
              value={effectiveOn}
              onChange={(event) => setEffectiveOn(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <ActionButton
              type="submit"
              intent="primary"
              disabled={loading}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {action}
            </ActionButton>
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}

function RuntimeBoundary({
  state,
  settings,
  retry,
}: {
  state: WorkbenchRuntimeState<unknown>;
  settings: boolean;
  retry: () => Promise<void>;
}) {
  const copy = settings ? statutoryInsuranceCopy.settings : statutoryInsuranceCopy.operations;
  if (state.kind === 'IDLE') {
    return (
      <GuidedEmptyState
        kind="empty"
        size="page"
        title={copy.idleTitle}
        description={copy.idleDescription}
      />
    );
  }
  if (state.kind === 'LOADING') {
    return (
      <Paper variant="outlined" sx={{ p: 2 }} aria-busy="true" role="status">
        <LoadingState size="page" variant="skeleton" skeletonRows={4} label={copy.loading} />
      </Paper>
    );
  }
  if (state.kind === 'EMPTY') {
    return (
      <GuidedEmptyState
        kind="empty"
        size="page"
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    );
  }
  if (state.kind === 'CLOSED' || state.kind === 'FORBIDDEN') {
    return (
      <GuidedEmptyState
        kind="permission"
        size="page"
        title={copy.forbiddenTitle}
        description={copy.forbiddenDescription}
      />
    );
  }
  if (state.kind === 'UNAVAILABLE') {
    return (
      <LocalErrorState
        size="page"
        title={copy.unavailableTitle}
        description={copy.unavailableDescription}
        retryLabel={copy.retry}
        onRetry={() => void retry()}
      />
    );
  }
  return null;
}

function ItemNavigation<T extends StatutoryConfigurationItem | SocialInsuranceItem>({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: readonly T[];
  selectedId: string | null;
  onSelect: (itemPublicId: string) => void;
}) {
  return (
    <Paper component="nav" aria-label={label} variant="outlined" sx={{ minWidth: 0 }}>
      <Box sx={{ px: 1.5, pt: 1.5 }}>
        <Typography component="h2" variant="subtitle1">
          {label}
        </Typography>
      </Box>
      <List disablePadding>
        {items.map((item) => (
          <ListItem key={item.itemPublicId} disablePadding>
            <ListItemButton
              selected={selectedId === item.itemPublicId}
              aria-pressed={selectedId === item.itemPublicId}
              onClick={() => onSelect(item.itemPublicId)}
              sx={{ alignItems: 'flex-start', minWidth: 0 }}
            >
              <ListItemText
                primary={item.title}
                secondary={item.itemPublicId}
                primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                secondaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
              />
              <Chip size="small" variant="outlined" label={item.statusCode} sx={{ ml: 1 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}

function SettingsDetail({ controller }: { controller: StatutoryConfigurationController }) {
  const selected = controller.selected;
  const projection = controller.projection;
  const [boundDraft, setBoundDraft] = useState<{
    targetId: string | null;
    draft: CountryPackActivationRequest;
  }>({ targetId: null, draft: EMPTY_ACTIVATION });
  if (!selected || !projection) return null;
  const copy = statutoryInsuranceCopy.settings;
  const draft = boundDraft.targetId === selected.itemPublicId ? boundDraft.draft : EMPTY_ACTIVATION;
  const selectedId = selected.itemPublicId;
  const metadata = visible(selected.fieldGroups.COUNTRY_PACK_METADATA);
  const rule = visible(selected.fieldGroups.STATUTORY_RULE);
  const status = visible(selected.fieldGroups.ACTIVATION_STATUS);
  function update(patch: Partial<CountryPackActivationRequest>) {
    setBoundDraft({ targetId: selectedId, draft: { ...draft, ...patch } });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void controller.activate(draft);
  }
  return (
    <Paper component="article" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack gap={2}>
        <Box minWidth={0}>
          <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {selected.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {selected.itemPublicId} · {selected.statusCode}
          </Typography>
        </Box>
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
            m: 0,
          }}
        >
          <EvidenceField label={copy.metadata}>
            {metadata
              ? `${metadata.key} · ${metadata.version}`
              : hidden(selected.fieldGroups.COUNTRY_PACK_METADATA)}
          </EvidenceField>
          <EvidenceField label={statutoryInsuranceCopy.common.digest}>
            {metadata?.digest ??
              (metadata ? copy.omitted : hidden(selected.fieldGroups.COUNTRY_PACK_METADATA))}
          </EvidenceField>
          <EvidenceField label={copy.rule}>
            {rule
              ? `${rule.policyKey} · ${rule.revision}`
              : hidden(selected.fieldGroups.STATUTORY_RULE)}
          </EvidenceField>
          <EvidenceField label={statutoryInsuranceCopy.common.effectivePeriod}>
            {rule
              ? `${rule.effectiveFrom} – ${rule.effectiveTo ?? 'open'}`
              : hidden(selected.fieldGroups.STATUTORY_RULE)}
          </EvidenceField>
          <EvidenceField label={copy.status}>
            {status ? status.code : hidden(selected.fieldGroups.ACTIVATION_STATUS)}
          </EvidenceField>
          <EvidenceField label={statutoryInsuranceCopy.common.revision}>
            {status?.revision ?? hidden(selected.fieldGroups.ACTIVATION_STATUS)}
          </EvidenceField>
        </Box>
        <FailureList
          failures={projection.queryState.partialFailures}
          titleId="pay003-settings-partial-failures-title"
        />
        {controller.activationAvailable && (
          <>
            <Divider />
            <Box component="form" onSubmit={submit} noValidate>
              <Stack gap={1.5}>
                <Box>
                  <Typography component="h3" variant="subtitle1">
                    {copy.preview}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {copy.impact}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    required
                    size="small"
                    label={copy.officialReferenceSet}
                    value={draft.officialReferenceSet}
                    onChange={(event) => update({ officialReferenceSet: event.target.value })}
                    inputProps={{ maxLength: 240 }}
                  />
                  <TextField
                    required
                    size="small"
                    type="date"
                    label={copy.effectiveDate}
                    value={draft.effectiveDate}
                    onChange={(event) => update({ effectiveDate: event.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    required
                    size="small"
                    label={copy.goldenPackDigest}
                    value={draft.goldenPackDigest}
                    onChange={(event) => update({ goldenPackDigest: event.target.value })}
                    inputProps={{ spellCheck: false }}
                  />
                  <TextField
                    required
                    size="small"
                    label={copy.approvalReceipt}
                    value={draft.statutoryApprovalReceiptId}
                    onChange={(event) => update({ statutoryApprovalReceiptId: event.target.value })}
                    inputProps={{ spellCheck: false }}
                  />
                </Box>
                <ActionButton
                  type="submit"
                  intent="primary"
                  disabled={controller.busy}
                  sx={{ alignSelf: { sm: 'flex-start' } }}
                >
                  {copy.activate}
                </ActionButton>
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function OperationsDetail({ controller }: { controller: SocialInsuranceController }) {
  const selected = controller.selected;
  const projection = controller.projection;
  if (!selected || !projection) return null;
  const copy = statutoryInsuranceCopy.operations;
  const insurance = visible(selected.fieldGroups.SOCIAL_INSURANCE);
  const policy = visible(selected.fieldGroups.POLICY_VERSION);
  return (
    <Paper component="article" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
      <Stack gap={2}>
        <Box minWidth={0}>
          <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {selected.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {selected.itemPublicId} · {selected.statusCode}
          </Typography>
        </Box>
        <Box
          component="dl"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
            m: 0,
          }}
        >
          <EvidenceField label={copy.insurance}>
            {insurance
              ? `${insurance.amount} ${insurance.currency}`
              : hidden(selected.fieldGroups.SOCIAL_INSURANCE)}
          </EvidenceField>
          <EvidenceField label={copy.policy}>
            {policy
              ? `${policy.policyKey} · ${policy.revision}`
              : hidden(selected.fieldGroups.POLICY_VERSION)}
          </EvidenceField>
          <EvidenceField label={statutoryInsuranceCopy.common.effectivePeriod}>
            {policy
              ? `${policy.effectiveFrom} – ${policy.effectiveTo ?? 'open'}`
              : hidden(selected.fieldGroups.POLICY_VERSION)}
          </EvidenceField>
          <EvidenceField label={statutoryInsuranceCopy.common.status}>
            {policy?.status ?? hidden(selected.fieldGroups.POLICY_VERSION)}
          </EvidenceField>
        </Box>
        <FailureList
          failures={projection.queryState.partialFailures}
          titleId="pay003-operations-partial-failures-title"
        />
      </Stack>
    </Paper>
  );
}

function ActiveSettingsWorkbench({
  scope,
  ownerBinding,
  dataSource,
  idFactory,
  now,
  locale,
  timeZone,
}: {
  scope: StatutoryInsuranceScope;
  ownerBinding?: StatutoryConfigurationOwnerBinding;
  dataSource?: StatutoryInsuranceDataSource;
  idFactory?: () => string;
  now?: () => number;
  locale: string;
  timeZone: string;
}) {
  const controller = useStatutoryConfigurationWorkbench({
    scope,
    ownerBinding,
    dataSource,
    idFactory,
    now,
  });
  const loaded = 'projection' in controller.state ? controller.state : null;
  const copy = statutoryInsuranceCopy.settings;
  const showData = ['PARTIAL', 'STALE', 'COMPLETE'].includes(controller.state.kind);
  return (
    <Stack
      data-slice="BASE-TFR-PAY-003"
      data-testid="pay003-settings-workbench"
      data-runtime-state={controller.state.kind.toLowerCase()}
      gap={2.5}
      sx={shellStyles()}
    >
      <SurfaceHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        loaded={loaded}
      />
      <ReviewForm
        question={copy.question}
        action={copy.review}
        loading={controller.state.kind === 'LOADING'}
        onReview={(effectiveOn) =>
          void controller.review({
            limit: 100,
            filter: effectiveOn ? { effectiveOn } : {},
            sort: ['itemPublicId:ASC'],
            locale,
            timeZone,
          })
        }
      />
      <Box aria-live="polite" aria-atomic="false">
        <Stack gap={1.5}>
          <ProjectionFeedback state={controller.state} settings />
          <SettingsActivationFeedback controller={controller} />
        </Stack>
      </Box>
      <RuntimeBoundary state={controller.state} settings retry={controller.retryRead} />
      {showData && controller.projection && (
        <Box
          data-testid="pay003-settings-primary-grid"
          data-primary-layout-breakpoint={
            STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.primarySplitMinCssPixels
          }
          sx={primaryGridStyles()}
        >
          <ItemNavigation
            label={copy.packs}
            items={controller.projection.items}
            selectedId={controller.selected?.itemPublicId ?? null}
            onSelect={controller.select}
          />
          <SettingsDetail controller={controller} />
        </Box>
      )}
    </Stack>
  );
}

function ActiveOperationsWorkbench({
  scope,
  ownerBinding,
  idFactory,
  now,
  locale,
  timeZone,
}: {
  scope: StatutoryInsuranceScope;
  ownerBinding?: SocialInsuranceOwnerBinding;
  idFactory?: () => string;
  now?: () => number;
  locale: string;
  timeZone: string;
}) {
  const controller = useSocialInsuranceWorkbench({ scope, ownerBinding, idFactory, now });
  const loaded = 'projection' in controller.state ? controller.state : null;
  const copy = statutoryInsuranceCopy.operations;
  const showData = ['PARTIAL', 'STALE', 'COMPLETE'].includes(controller.state.kind);
  return (
    <Stack
      data-slice="BASE-TFR-PAY-003"
      data-testid="pay003-operations-workbench"
      data-runtime-state={controller.state.kind.toLowerCase()}
      gap={2.5}
      sx={shellStyles()}
    >
      <SurfaceHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        loaded={loaded}
      />
      <ReviewForm
        question={copy.question}
        action={copy.review}
        loading={controller.state.kind === 'LOADING'}
        onReview={(effectiveOn) =>
          void controller.review({
            limit: 100,
            filter: effectiveOn ? { effectiveOn } : {},
            sort: ['itemPublicId:ASC'],
            locale,
            timeZone,
          })
        }
      />
      <Box aria-live="polite" aria-atomic="false">
        <ProjectionFeedback state={controller.state} settings={false} />
      </Box>
      <RuntimeBoundary state={controller.state} settings={false} retry={controller.retryRead} />
      {showData && controller.projection && (
        <Box
          data-testid="pay003-operations-primary-grid"
          data-primary-layout-breakpoint={
            STATUTORY_INSURANCE_RESPONSIVE_CONTRACT.primarySplitMinCssPixels
          }
          sx={primaryGridStyles()}
        >
          <ItemNavigation
            label={copy.results}
            items={controller.projection.items}
            selectedId={controller.selected?.itemPublicId ?? null}
            onSelect={controller.select}
          />
          <OperationsDetail controller={controller} />
        </Box>
      )}
    </Stack>
  );
}

type CommonWorkbenchProps = Readonly<{
  rollout?: StatutoryInsuranceRollout;
  admission?: StatutoryInsuranceTrustedAdmission;
  idFactory?: () => string;
  now?: () => number;
  locale?: string;
  timeZone?: string;
}>;

export type HrisStatutoryConfigurationWorkbenchProps = CommonWorkbenchProps &
  Readonly<{
    ownerBinding?: StatutoryConfigurationOwnerBinding;
    dataSource?: StatutoryInsuranceDataSource;
  }>;

export function HrisStatutoryConfigurationWorkbench({
  rollout = STATUTORY_INSURANCE_DEFAULT_ROLLOUT,
  admission,
  ownerBinding,
  dataSource,
  idFactory,
  now,
  locale = 'en-US',
  timeZone = 'UTC',
}: HrisStatutoryConfigurationWorkbenchProps) {
  const scope = admittedScope(admission, rollout, STATUTORY_CONFIGURATION_PAGE_ROUTE_CONTRACT_KEY);
  if (!scope) return <ClosedSurface settings />;
  return (
    <ActiveSettingsWorkbench
      scope={scope}
      ownerBinding={ownerBinding}
      dataSource={dataSource}
      idFactory={idFactory}
      now={now}
      locale={locale}
      timeZone={timeZone}
    />
  );
}

export type HrisPayTaxSocialInsuranceWorkbenchProps = CommonWorkbenchProps &
  Readonly<{ ownerBinding?: SocialInsuranceOwnerBinding }>;

export function HrisPayTaxSocialInsuranceWorkbench({
  rollout = STATUTORY_INSURANCE_DEFAULT_ROLLOUT,
  admission,
  ownerBinding,
  idFactory,
  now,
  locale = 'en-US',
  timeZone = 'UTC',
}: HrisPayTaxSocialInsuranceWorkbenchProps) {
  const scope = admittedScope(admission, rollout, SOCIAL_INSURANCE_PAGE_ROUTE_CONTRACT_KEY);
  if (!scope) return <ClosedSurface settings={false} />;
  return (
    <ActiveOperationsWorkbench
      scope={scope}
      ownerBinding={ownerBinding}
      idFactory={idFactory}
      now={now}
      locale={locale}
      timeZone={timeZone}
    />
  );
}
