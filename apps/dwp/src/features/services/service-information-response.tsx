import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareReply } from 'lucide-react';
import {
  ActionButton,
  ConfirmDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import {
  getMyServiceRequest,
  respondToServiceInformationRequest,
} from '@dwp-frontend/shared-utils/api/service-center-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useProductActionMutation } from '../../components/use-product-action-mutation';
import { useContextualProductActionMutation } from '../../components/use-contextual-product-action-mutation';
import { useProductSurfaceCapabilityAccess } from '../../components/product-surface-capability-access';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import {
  prepareServiceInformationResponse,
  serviceResponseCanDispatch,
  serviceResponseReceiptMatches,
} from './service-information-response-model';
import { ServiceInformationResponseFields } from './service-information-response-fields';
import type {
  ServiceInformationResponseInput,
  ServiceRequestDetail,
} from '@dwp-frontend/shared-utils/api/service-center-api';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export type ServiceInformationResponseDraft = Readonly<{
  key: string;
  expectedVersion: number;
  message: string;
}>;

type PendingDraftReplacement = Readonly<{
  key: string;
  expectedVersion: number;
  message: string;
}>;

export type ServiceInformationResponseProps = {
  detail: ServiceRequestDetail;
  onConfirmed: (receipt: ServiceRequestDetail) => void;
  onRefresh: () => void;
  contextual?: boolean;
  appliedDraft?: ServiceInformationResponseDraft | null;
  onDraftApplied?: () => void;
};

type ServiceInformationResponseRuntime = Readonly<{
  owner: string | null;
  canRespond: boolean;
  contextScopeKey?: string;
  runResponse: <T>(
    execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
  ) => Promise<T>;
}>;

export function ServiceInformationResponse(props: ServiceInformationResponseProps) {
  return props.contextual ? (
    <ContextualServiceInformationResponse {...props} />
  ) : (
    <PageServiceInformationResponse {...props} />
  );
}

function PageServiceInformationResponse(props: ServiceInformationResponseProps) {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();
  const capability = useProductSurfaceCapabilityAccess();
  const scope = useProductSurfaceRequestScope({
    productKey: 'services',
    surfaceKey: 'services.work',
  });
  const runResponse = useProductActionMutation(
    'route.services.work.request-information-response.action'
  );
  const owner =
    isAuthenticated && user
      ? `${user.identityPlane}:${user.tenantId}:${user.userId}:${scope.queryMeta.accessMode}:${scope.contextScopeKey ?? ''}`
      : null;
  return (
    <ServiceInformationResponseForm
      {...props}
      runtime={{
        owner,
        canRespond:
          scope.ready &&
          (capability.governed
            ? capability.hasWritableCapability('services.request.respond')
            : hasPermission('APP.EMPLOYEE_SERVICES', 'UPDATE')),
        contextScopeKey: scope.contextScopeKey,
        runResponse,
      }}
    />
  );
}

function ContextualServiceInformationResponse(props: ServiceInformationResponseProps) {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();
  const action = useContextualProductActionMutation(
    'route.services.work.request-information-response.action',
    'services.request.respond',
    'SELF'
  );
  const owner =
    isAuthenticated && user
      ? `${user.identityPlane}:${user.tenantId}:${user.userId}:${action.accessMode}:${action.contextKey}:${action.contextScopeKind}:${action.contextScopeKey ?? ''}`
      : null;
  return (
    <ServiceInformationResponseForm
      {...props}
      runtime={{
        owner,
        canRespond:
          action.ready &&
          (action.governed
            ? action.hasWritableCapability
            : hasPermission('APP.EMPLOYEE_SERVICES', 'UPDATE')),
        contextScopeKey: action.contextScopeKey,
        runResponse: action.run,
      }}
    />
  );
}

function ServiceInformationResponseForm({
  detail,
  onConfirmed,
  onRefresh,
  appliedDraft,
  onDraftApplied,
  runtime,
}: ServiceInformationResponseProps & { runtime: ServiceInformationResponseRuntime }) {
  const { t } = useTranslation(['services', 'work']);
  const { owner, canRespond, contextScopeKey, runResponse } = runtime;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const mounted = useRef(false);
  const generation = useRef(0);
  const locked = useRef(false);
  const appliedDraftKey = useRef<string | null>(null);
  const responseAuthority = useRef(canRespond);
  const [base, setBase] = useState(detail);
  const [values, setValues] = useState(detail.values);
  const [message, setMessage] = useState('');
  const [draftReplacement, setDraftReplacement] = useState<PendingDraftReplacement | null>(null);
  const [preview, setPreview] = useState<ServiceInformationResponseInput | null>(null);
  const [uncertain, setUncertain] = useState<ServiceInformationResponseInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'conflict' | 'denied' | 'unknown' | 'success' | null>(
    null
  );
  const [latest, setLatest] = useState<ServiceRequestDetail | null>(null);
  const latestDetail = latest && latest.request.version > detail.request.version ? latest : detail;
  const changed = latestDetail.request.version !== base.request.version;
  useEffect(() => {
    generation.current += 1;
    mounted.current = true;
    setBase(detail);
    setValues(detail.values);
    setMessage('');
    setDraftReplacement(null);
    setPreview(null);
    setUncertain(null);
    setFeedback(null);
    setLatest(null);
    setBusy(false);
    locked.current = false;
    appliedDraftKey.current = null;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
    // Snapshot changes are reviewed explicitly; only identity changes discard private drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, detail.request.requestId]);

  useEffect(() => {
    const wasAllowed = responseAuthority.current;
    responseAuthority.current = canRespond;
    if (!wasAllowed || canRespond) return;
    generation.current += 1;
    locked.current = false;
    setValues(detail.values);
    setMessage('');
    setDraftReplacement(null);
    setPreview(null);
    setUncertain(null);
    setLatest(null);
    setFeedback(null);
    setBusy(false);
  }, [canRespond, detail.values]);

  useEffect(() => {
    if (
      !canRespond ||
      !appliedDraft ||
      appliedDraft.key === appliedDraftKey.current ||
      appliedDraft.key === draftReplacement?.key ||
      appliedDraft.expectedVersion !== base.request.version ||
      changed ||
      base.request.status !== 'AWAITING_REQUESTER'
    )
      return;
    const nextMessage = appliedDraft.message.trim().slice(0, 2000);
    if (nextMessage.length < 10) return;
    if (message.trim()) {
      setDraftReplacement({
        key: appliedDraft.key,
        expectedVersion: appliedDraft.expectedVersion,
        message: nextMessage,
      });
      return;
    }
    appliedDraftKey.current = appliedDraft.key;
    setMessage(nextMessage);
    setPreview(null);
    onDraftApplied?.();
  }, [
    appliedDraft,
    base.request.status,
    base.request.version,
    canRespond,
    changed,
    draftReplacement?.key,
    message,
    onDraftApplied,
  ]);

  useEffect(() => {
    if (
      !draftReplacement ||
      (canRespond &&
        !changed &&
        draftReplacement.expectedVersion === base.request.version &&
        base.request.status === 'AWAITING_REQUESTER')
    )
      return;
    appliedDraftKey.current = draftReplacement.key;
    setDraftReplacement(null);
    onDraftApplied?.();
  }, [
    base.request.status,
    base.request.version,
    canRespond,
    changed,
    draftReplacement,
    onDraftApplied,
  ]);

  useEffect(() => {
    if (
      feedback === 'success' &&
      detail.request.status === 'AWAITING_REQUESTER' &&
      detail.request.version > base.request.version
    ) {
      setBase(detail);
      setValues(detail.values);
      setLatest(null);
      setFeedback(null);
    }
  }, [base.request.version, detail, feedback]);

  const submit = async (command: ServiceInformationResponseInput, replay = false) => {
    if (locked.current || !canRespond || !owner) return;
    locked.current = true;
    setBusy(true);
    const submittingOwner = owner;
    const submittingGeneration = generation.current;
    const isCurrent = () =>
      mounted.current &&
      ownerRef.current === submittingOwner &&
      generation.current === submittingGeneration;
    let dispatched = false;
    try {
      const current = await getMyServiceRequest(base.request.requestId, contextScopeKey);
      if (!isCurrent()) return;
      if (!serviceResponseCanDispatch(current, base.request.requestId, command, replay)) {
        setLatest(current);
        setFeedback('conflict');
        setPreview(null);
        setUncertain(null);
        onRefresh();
        return;
      }
      const receipt = await runResponse((authority) => {
        if (!isCurrent()) throw new Error('Response context changed');
        dispatched = true;
        return respondToServiceInformationRequest(base.request.requestId, command, authority);
      });
      if (!isCurrent()) return;
      if (!serviceResponseReceiptMatches(receipt, base.request.requestId, command))
        throw new Error('Unconfirmed response receipt');
      setBase(receipt);
      setValues(receipt.values);
      setFeedback('success');
      setPreview(null);
      setUncertain(null);
      setMessage('');
      onConfirmed(receipt);
    } catch (error) {
      if (!isCurrent()) return;
      setPreview(null);
      if (error instanceof HttpError && error.status === 409) {
        setFeedback('conflict');
        setUncertain(null);
        onRefresh();
      } else if (
        !dispatched ||
        (error instanceof HttpError && [400, 401, 403, 404, 422].includes(error.status))
      ) {
        setFeedback(replay ? 'unknown' : 'denied');
        // A failed receipt lookup cannot prove that the earlier timed-out command was rejected.
        setUncertain(replay ? command : null);
      } else {
        setFeedback('unknown');
        setUncertain(command);
      }
    } finally {
      if (isCurrent()) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  const prepare = () => {
    if (!canRespond || changed || uncertain) return;
    const command = prepareServiceInformationResponse(base, message, values, crypto.randomUUID());
    if (command) setPreview(command);
  };
  const valid = Boolean(prepareServiceInformationResponse(base, message, values, 'validation'));
  if (feedback === 'success')
    return <InlineFeedback severity="success">{t('informationResponse.success')}</InlineFeedback>;
  if (detail.request.status !== 'AWAITING_REQUESTER' && !uncertain && !message) return null;
  const requestNote = detail.timeline.find(
    (event) => event.status === 'AWAITING_REQUESTER' && event.note?.trim()
  )?.note;
  return (
    <Box
      component="section"
      data-testid="service-information-response"
      aria-labelledby="service-information-response-title"
      sx={{
        border: 1,
        borderColor: 'warning.light',
        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        gap={1}
        sx={{ p: 2, bgcolor: 'warning.lighter', color: 'warning.dark' }}
      >
        <MessageSquareReply size={20} aria-hidden="true" />
        <Box>
          <Typography id="service-information-response-title" component="h2" variant="subtitle1">
            {t('informationResponse.title')}
          </Typography>
          <Typography variant="body2">
            {requestNote || t('informationResponse.description')}
          </Typography>
        </Box>
      </Stack>
      <Stack gap={2} sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Typography variant="body2" color="text.secondary">
          {t('informationResponse.nextStep')}
        </Typography>
        {!canRespond && (
          <InlineFeedback severity="warning">{t('informationResponse.unavailable')}</InlineFeedback>
        )}
        {(changed || feedback === 'conflict') && (
          <InlineFeedback severity="warning">{t('informationResponse.conflict')}</InlineFeedback>
        )}
        {feedback === 'denied' && (
          <InlineFeedback severity="error">{t('informationResponse.denied')}</InlineFeedback>
        )}
        {uncertain && (
          <InlineFeedback severity="warning">{t('informationResponse.unknown')}</InlineFeedback>
        )}
        <ServiceInformationResponseFields
          fields={base.requestSchema.fields}
          values={values}
          disabled={busy || !canRespond || Boolean(uncertain)}
          onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
        />
        <FormField
          label={t('informationResponse.message')}
          value={message}
          required
          multiline
          minRows={4}
          disabled={busy || !canRespond || Boolean(uncertain)}
          supportingText={t('informationResponse.messageHelp', { count: message.trim().length })}
          onChange={(event) => setMessage(event.target.value.slice(0, 2000))}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" gap={1}>
          {(changed || feedback === 'conflict') && !uncertain && (
            <ActionButton
              intent="secondary"
              disabled={busy || latestDetail.request.status !== 'AWAITING_REQUESTER'}
              onClick={() => {
                const nextValues = Object.fromEntries(
                  latestDetail.requestSchema.fields.map((field) => [
                    field.key,
                    values[field.key] ?? latestDetail.values[field.key] ?? '',
                  ])
                );
                setBase(latestDetail);
                setValues(nextValues);
                setFeedback(null);
                setPreview(null);
              }}
            >
              {t('informationResponse.reviewLatest')}
            </ActionButton>
          )}
          {uncertain ? (
            <ActionButton
              intent="primary"
              disabled={!canRespond}
              loading={busy}
              onClick={() => void submit(uncertain, true)}
            >
              {t('informationResponse.checkResult')}
            </ActionButton>
          ) : (
            <ActionButton
              intent="primary"
              disabled={
                !valid ||
                !canRespond ||
                changed ||
                feedback === 'conflict' ||
                detail.request.status !== 'AWAITING_REQUESTER'
              }
              loading={busy}
              onClick={prepare}
            >
              {t('informationResponse.review')}
            </ActionButton>
          )}
        </Stack>
      </Stack>
      <ConfirmDialog
        open={Boolean(draftReplacement)}
        title={t('workHub.sourceDetail.service.replaceDraftTitle', { ns: 'work' })}
        description={t('workHub.sourceDetail.service.replaceDraftDescription', { ns: 'work' })}
        cancelLabel={t('informationResponse.back')}
        confirmLabel={t('workHub.sourceDetail.service.replaceDraft', { ns: 'work' })}
        onClose={() => {
          if (draftReplacement) {
            appliedDraftKey.current = draftReplacement.key;
            onDraftApplied?.();
          }
          setDraftReplacement(null);
        }}
        onConfirm={() => {
          if (draftReplacement) {
            const current =
              canRespond &&
              !changed &&
              draftReplacement.expectedVersion === base.request.version &&
              base.request.status === 'AWAITING_REQUESTER';
            appliedDraftKey.current = draftReplacement.key;
            if (current) {
              setMessage(draftReplacement.message);
              setPreview(null);
            }
            onDraftApplied?.();
          }
          setDraftReplacement(null);
        }}
        details={
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {draftReplacement?.message}
          </Typography>
        }
      />
      <ConfirmDialog
        open={Boolean(preview)}
        title={t('informationResponse.confirmTitle')}
        description={t('informationResponse.confirmDescription')}
        cancelLabel={t('informationResponse.back')}
        confirmLabel={t('informationResponse.submit')}
        busy={busy}
        onClose={() => setPreview(null)}
        onConfirm={() => {
          if (preview) void submit(preview);
        }}
        details={
          <Stack gap={1}>
            <Typography variant="subtitle2">{detail.request.summary}</Typography>
            {preview && (
              <ServiceInformationResponseFields
                fields={base.requestSchema.fields}
                values={preview.values}
                disabled
                onChange={() => undefined}
              />
            )}
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {preview?.message}
            </Typography>
          </Stack>
        }
      />
    </Box>
  );
}
