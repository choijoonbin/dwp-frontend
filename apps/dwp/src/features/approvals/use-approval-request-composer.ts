import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  dwaionHandoffText,
  getApprovalRequestDetail,
  getPublishedApprovalFormTemplate,
  getPublishedApprovalForms,
  HttpError,
  parseDwaionHandoff,
  preflightApprovalRequest,
  submitApprovalRequest,
  useToast,
} from '@dwp-frontend/shared-utils';

import {
  approvalRequestCanSubmit,
  approvalRequestPayload,
  approvalRequestRecovery,
  missingApprovalRequestFields,
} from './approval-request-model';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalRequestAutosave } from './use-approval-request-autosave';
import { approvalRequestCommandResultUnknown } from './approval-request-command-model';
import { useApprovalRequestUserSource } from './use-approval-request-user-source';
import { useApprovalRequestFormEvaluation } from './use-approval-request-form-evaluation';
import {
  approvalRequestPublishedSchemaMatches,
  approvalRequestEditingValues,
  approvalRequestStoredEditingValues,
  approvalRequestValuePresent,
} from './approval-request-schema-model';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import {
  approvalRequestFormChangeImpact,
  approvalRequestValidationIssues,
} from './approval-request-composer-review';

import type { ApprovalPriority, ApprovalRequestServerPreflight } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';
import type { ApprovalDraftSnapshot } from './approval-request-autosave-model';
import type { ApprovalRequestUserContext } from './approval-request-user-picker';

type SaveIntent = 'DRAFT' | 'SUBMIT' | 'CLOSE';
type SaveCommand = ApprovalManagementScopedCommand<
  Readonly<{ intent: SaveIntent; idempotencyKey?: string }>
>;
type PreflightCommand = ApprovalManagementScopedCommand<Readonly<{ intent: 'PREFLIGHT' }>>;
type RecoveryState = Readonly<{
  kind: ReturnType<typeof approvalRequestRecovery> | 'UNKNOWN';
  latestLoaded: boolean;
}>;
type QuarantinedEditor = Readonly<{
  sessionKey: string;
  snapshot: ApprovalDraftSnapshot;
  formId: string;
  title: string;
  summary: string;
  priority: ApprovalPriority;
  payloadValues: Record<string, unknown>;
}>;

function accessDenied(error: unknown) {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

export function useApprovalRequestComposer() {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const draftId = searchParams.get('draft');
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const binding = commandScope.binding;
  const sessionKey = JSON.stringify([binding.scopeIdentity, binding.scopeEpoch, draftId]);
  const [contentSessionKey, setContentSessionKey] = useState(sessionKey);
  const [formId, setFormId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState<ApprovalPriority>('NORMAL');
  const [payloadValues, setPayloadValues] = useState<Record<string, unknown>>({});
  const [hydratedDraftId, setHydratedDraftId] = useState('');
  const [dwaionDraft, setDwaionDraft] = useState(false);
  const [pendingFormId, setPendingFormId] = useState('');
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [serverPreflight, setServerPreflight] = useState<ApprovalRequestServerPreflight>();
  const [manualRecovery, setManualRecovery] = useState<RecoveryState>();
  const [quarantinedEditor, setQuarantinedEditor] = useState<QuarantinedEditor>();
  const quarantined = quarantinedEditor?.sessionKey === sessionKey ? quarantinedEditor : undefined;
  const boundFormId = quarantined?.formId ?? formId;
  const sessionRef = useRef(sessionKey);
  const manualFlight = useRef<SaveCommand | undefined>(undefined);
  const submittedAttempt = useRef<
    Readonly<{ command: SaveCommand; requestId: string; version: number }> | undefined
  >(undefined);
  const [submissionUnknown, setSubmissionUnknown] = useState(false);
  const [sourceDraft, setSourceDraft] =
    useState<Readonly<{ requestId: string; version: number }>>();
  sessionRef.current = sessionKey;

  const forms = useQuery({
    queryKey: ['approvals', ...requestScope.cacheKey, 'forms', 'published'],
    queryFn: ({ signal }) => getPublishedApprovalForms(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 60_000,
    retry: false,
  });
  const draft = useQuery({
    queryKey: ['approvals', ...requestScope.cacheKey, 'requests', 'detail', draftId],
    queryFn: ({ signal }) =>
      getApprovalRequestDetail(draftId!, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(draftId),
    meta: requestScope.queryMeta,
    staleTime: 0,
    retry: false,
  });
  const template = useQuery({
    queryKey: [
      'approvals',
      ...requestScope.cacheKey,
      'forms',
      'published',
      boundFormId,
      'template',
    ],
    queryFn: ({ signal }) =>
      getPublishedApprovalFormTemplate(boundFormId, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(boundFormId),
    meta: requestScope.queryMeta,
    staleTime: 60_000,
    retry: false,
  });
  const dwaionHandoff = useMemo(
    () => parseDwaionHandoff(location.state, 'APPROVAL.REQUEST.CREATE'),
    [location.state]
  );
  const currentDraftDetail =
    draftId &&
    !draft.isError &&
    !draft.isFetching &&
    draft.data?.request.requestId === draftId &&
    draft.data.request.status === 'DRAFT'
      ? draft.data
      : undefined;
  const formEvaluation = useApprovalRequestFormEvaluation({
    schema: template.isError || template.isFetching ? undefined : template.data?.form.schema,
    values: quarantined?.payloadValues ?? payloadValues,
    summary: quarantined?.summary ?? summary,
    enabled: requestScope.ready && Boolean(boundFormId),
  });
  const storedEvaluation = useApprovalRequestFormEvaluation({
    schema: currentDraftDetail?.formSchema,
    values: currentDraftDetail?.payload ?? {},
    summary: currentDraftDetail?.request.summary ?? '',
    enabled: requestScope.ready && Boolean(currentDraftDetail),
  });
  const schemaBindingReady =
    formEvaluation.kind !== 'TYPED' ||
    (approvalRequestPublishedSchemaMatches(
      formEvaluation.compiled,
      template.data?.form.schemaHash
    ) &&
      (!draftId ||
        (storedEvaluation.kind === 'TYPED' &&
          storedEvaluation.draftValid &&
          storedEvaluation.compiled?.schemaSha256 === formEvaluation.compiled?.schemaSha256)));
  const userBinding = useMemo<ApprovalRequestUserContext | undefined>(() => {
    const form = template.data?.form;
    const version = draftId ? currentDraftDetail?.formVersionId : form?.formVersionId;
    const hash = formEvaluation.compiled?.schemaSha256;
    if (
      !formId ||
      !version ||
      !hash ||
      !schemaBindingReady ||
      (draftId && currentDraftDetail?.formSchemaSha256 !== hash)
    )
      return undefined;
    const owner = sourceDraft ?? currentDraftDetail?.request;
    return {
      formId,
      formVersionId: version,
      schemaSha256: hash,
      surface: 'WORK',
      requestId: owner?.requestId,
      requestVersion: owner?.version,
    };
  }, [
    formId,
    draftId,
    currentDraftDetail,
    template.data,
    formEvaluation.compiled,
    schemaBindingReady,
    sourceDraft,
  ]);
  const userSource = useApprovalRequestUserSource({
    identity: sessionKey,
    binding: userBinding,
    compiled: formEvaluation.compiled ?? undefined,
    evaluation: formEvaluation.draftEvaluation,
    values: payloadValues,
  });

  useEffect(() => {
    setContentSessionKey(sessionKey);
    manualFlight.current = undefined;
    submittedAttempt.current = undefined;
    setSubmissionUnknown(false);
    setSourceDraft(undefined);
    setFormId('');
    setTitle('');
    setSummary('');
    setPriority('NORMAL');
    setPayloadValues({});
    setHydratedDraftId('');
    setDwaionDraft(false);
    setPendingFormId('');
    setServerPreflight(undefined);
    setManualRecovery(undefined);
    setPreflightOpen(false);
    setQuarantinedEditor(undefined);
  }, [sessionKey]);

  useEffect(() => {
    if (
      !draftId ||
      !draft.data ||
      draft.isError ||
      draft.isFetching ||
      draft.data.request.requestId !== draftId ||
      draft.data.request.status !== 'DRAFT' ||
      hydratedDraftId === draftId
    )
      return;
    if (quarantined) return;
    if (formId !== draft.data.formId) {
      setFormId(draft.data.formId);
      return;
    }
    if (!storedEvaluation.schemaReady || !storedEvaluation.draftValid || !schemaBindingReady)
      return;
    const values = approvalRequestStoredEditingValues(draft.data, storedEvaluation.compiled);
    setTitle(draft.data.request.title);
    setSummary(draft.data.request.summary);
    setPriority(draft.data.request.priority);
    setPayloadValues(values);
    setHydratedDraftId(draftId);
  }, [
    draft.data,
    draft.isError,
    draft.isFetching,
    draftId,
    hydratedDraftId,
    quarantined,
    formId,
    storedEvaluation.schemaReady,
    storedEvaluation.draftValid,
    storedEvaluation.compiled,
    schemaBindingReady,
  ]);

  useEffect(() => {
    if (draftId || !dwaionHandoff) return;
    const handoffTitle = dwaionHandoffText(dwaionHandoff, 'title');
    const handoffSummary = dwaionHandoffText(dwaionHandoff, 'businessJustification');
    const handoffForm = dwaionHandoffText(dwaionHandoff, 'formType');
    if (handoffTitle) setTitle(handoffTitle);
    if (handoffSummary) setSummary(handoffSummary);
    if (handoffForm && forms.data?.some((form) => form.formId === handoffForm))
      setFormId(handoffForm);
    setDwaionDraft(true);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null }
    );
  }, [draftId, dwaionHandoff, forms.data, location.pathname, location.search, navigate]);

  const fields = useMemo(
    () => formEvaluation.legacyFields.filter((field) => field.key !== 'summary'),
    [formEvaluation.legacyFields]
  );
  const missingFields = useMemo(
    () => missingApprovalRequestFields(fields, formEvaluation.legacyValues),
    [fields, formEvaluation.legacyValues]
  );
  const authoritativeContextReady =
    requestScope.ready &&
    Boolean(boundFormId) &&
    Boolean(template.data) &&
    formEvaluation.kind !== 'ABSENT' &&
    formEvaluation.schemaReady &&
    formEvaluation.draftValid &&
    userSource.ready &&
    schemaBindingReady &&
    !forms.isFetching &&
    !forms.isError &&
    !draft.isFetching &&
    !draft.isError &&
    (!draftId || (draft.data?.request.status === 'DRAFT' && hydratedDraftId === draftId)) &&
    !template.isFetching &&
    !template.isError;
  const input = useMemo<ApprovalDraftSnapshot | undefined>(
    () =>
      quarantined?.snapshot ??
      (template.data &&
      formId &&
      contentSessionKey === sessionKey &&
      (!draftId || hydratedDraftId === draftId)
        ? {
            workflowId: template.data.workflow.workflowId,
            formId,
            title: title.trim(),
            summary: summary.trim(),
            priority,
            payload:
              formEvaluation.kind === 'TYPED'
                ? (formEvaluation.draftEvaluation?.payload ?? {})
                : approvalRequestPayload(summary, formEvaluation.legacyValues),
          }
        : undefined),
    [
      template.data,
      formId,
      title,
      summary,
      priority,
      contentSessionKey,
      sessionKey,
      draftId,
      hydratedDraftId,
      quarantined,
      formEvaluation.kind,
      formEvaluation.draftEvaluation,
      formEvaluation.legacyValues,
    ]
  );
  const autosave = useApprovalRequestAutosave({
    sessionKey,
    input,
    ready: authoritativeContextReady && !manualRecovery,
    initialDetail: draftId && hydratedDraftId === draftId ? draft.data : undefined,
    contextScopeKey: requestScope.contextScopeKey,
    isCurrent: () => sessionRef.current === sessionKey && commandScope.isCurrent(binding),
    canWrite: userSource.isReady,
  });
  const autosaveRecovery = ['CONFLICT', 'DENIED', 'UNAVAILABLE', 'UNKNOWN', 'ERROR'].includes(
    autosave.status
  )
    ? { kind: autosave.status, latestLoaded: autosave.latestLoaded }
    : undefined;
  useEffect(() => {
    if (!autosave.receipt) return;
    const { requestId, version } = autosave.receipt;
    setSourceDraft((previous) =>
      previous?.requestId === requestId && previous.version === version
        ? previous
        : { requestId, version }
    );
  }, [autosave.receipt]);
  const recovery = manualRecovery ?? autosaveRecovery;
  const contentMasked =
    Boolean(quarantined) ||
    contentSessionKey !== sessionKey ||
    recovery?.kind === 'DENIED' ||
    !requestScope.ready ||
    accessDenied(draft.error) ||
    accessDenied(forms.error) ||
    accessDenied(template.error);
  const reviewReady =
    requestScope.ready &&
    Boolean(boundFormId) &&
    Boolean(template.data) &&
    formEvaluation.kind !== 'ABSENT' &&
    formEvaluation.schemaReady &&
    schemaBindingReady &&
    !forms.isFetching &&
    !forms.isError &&
    !draft.isFetching &&
    !draft.isError &&
    (!draftId || (draft.data?.request.status === 'DRAFT' && hydratedDraftId === draftId)) &&
    !template.isFetching &&
    !template.isError &&
    !contentMasked;
  const contextReady = authoritativeContextReady && !recovery && !contentMasked;
  const submissionReady =
    formEvaluation.submitValid &&
    approvalRequestCanSubmit({
      contextReady,
      title,
      summary,
      fields,
      values: formEvaluation.legacyValues,
    });
  const validationIssues = useMemo(
    () =>
      approvalRequestValidationIssues({
        title,
        summary,
        titleLabel: t('requests.fields.title'),
        summaryLabel: t('requests.fields.summary'),
        businessFieldsLabel: t('requests.template.businessFields'),
        korean,
        legacyMissing: missingFields,
        typedFields: formEvaluation.compiled?.definition.fields,
        typedMissingPaths: formEvaluation.missing,
        invalidPath:
          formEvaluation.submitError?.fieldPath ??
          formEvaluation.draftError?.fieldPath ??
          (formEvaluation.kind === 'TYPED' && !formEvaluation.submitValid
            ? '$business-fields'
            : undefined),
        userSourcePath: userSource.unreadyPath,
      }),
    [
      title,
      summary,
      t,
      korean,
      missingFields,
      formEvaluation.compiled,
      formEvaluation.missing,
      formEvaluation.submitError,
      formEvaluation.draftError,
      formEvaluation.kind,
      formEvaluation.submitValid,
      userSource.unreadyPath,
    ]
  );
  const pendingFormChange = useMemo(
    () =>
      approvalRequestFormChangeImpact({
        forms: forms.data ?? [],
        sourceFormId: formId,
        targetFormId: pendingFormId,
        values: payloadValues,
        korean,
        legacyFields: fields,
        typedFields: formEvaluation.compiled?.definition.fields,
      }),
    [forms.data, formId, pendingFormId, payloadValues, korean, fields, formEvaluation.compiled]
  );
  const schemaHash = formEvaluation.compiled?.schemaSha256;
  const currentAuthority = useRef({ authoritativeContextReady, submissionReady, schemaHash });
  currentAuthority.current = { authoritativeContextReady, submissionReady, schemaHash };

  useEffect(() => {
    const unboundInput =
      !input &&
      Boolean(
        title.trim() ||
        summary.trim() ||
        Object.values(payloadValues).some(approvalRequestValuePresent)
      );
    if (!autosave.dirty && autosave.status !== 'SAVING' && !unboundInput && !submissionUnknown)
      return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [autosave.dirty, autosave.status, input, title, summary, payloadValues, submissionUnknown]);

  useEffect(() => {
    if (
      recovery?.kind !== 'DENIED' &&
      !accessDenied(draft.error) &&
      !accessDenied(forms.error) &&
      !accessDenied(template.error)
    )
      return;
    // A denied receipt read must not turn an unresolved command into a blank replacement save.
    if (
      !quarantined &&
      input &&
      (autosave.unresolved || autosave.status === 'SAVING' || submissionUnknown)
    ) {
      setQuarantinedEditor({
        sessionKey,
        snapshot: structuredClone(input),
        formId,
        title,
        summary,
        priority,
        payloadValues: structuredClone(payloadValues),
      });
    }
    if (title) setTitle('');
    if (summary) setSummary('');
    if (Object.keys(payloadValues).length) setPayloadValues({});
    if (formId) setFormId('');
    if (priority !== 'NORMAL') setPriority('NORMAL');
    setPreflightOpen(false);
  }, [
    recovery?.kind,
    draft.error,
    forms.error,
    template.error,
    quarantined,
    input,
    autosave.unresolved,
    autosave.status,
    submissionUnknown,
    sessionKey,
    formId,
    title,
    summary,
    priority,
    payloadValues,
  ]);

  const runPreflight = useApprovalGovernedMutation('route.approvals.work.request-preflight.action');
  const runSubmit = useApprovalGovernedMutation('route.approvals.work.request-submit.action');
  const persistedRef = useRef<string | undefined>(undefined);
  const preflight = useMutation({
    retry: false,
    mutationFn: async (command: PreflightCommand) => {
      if (
        !commandScope.isCurrent(command) ||
        sessionRef.current !== sessionKey ||
        !authoritativeContextReady ||
        !submissionReady
      )
        throw new HttpError('Approval request context is not current.', 409);
      const persisted = await autosave.flush();
      await userSource.waitForOwner(
        persisted.requestId,
        persisted.version,
        () => commandScope.isCurrent(command) && sessionRef.current === sessionKey
      );
      const result = await runPreflight(async (execution) => {
        if (
          !commandScope.isCurrent(command) ||
          sessionRef.current !== sessionKey ||
          !currentAuthority.current.authoritativeContextReady ||
          !currentAuthority.current.submissionReady ||
          !userSource.isReady() ||
          currentAuthority.current.schemaHash !== schemaHash
        )
          throw new HttpError('Approval request identity changed.', 409);
        return preflightApprovalRequest(persisted.requestId, persisted.version, execution);
      });
      return { command, result };
    },
    onSuccess: ({ command, result }) => {
      if (!commandScope.isCurrent(command) || sessionRef.current !== sessionKey) return;
      setServerPreflight(result);
      setPreflightOpen(true);
    },
    onError: (_, command) => {
      if (!commandScope.isCurrent(command) || sessionRef.current !== sessionKey) return;
      setServerPreflight(undefined);
      setPreflightOpen(true);
    },
  });
  const save = useMutation({
    retry: false,
    mutationFn: async (command: SaveCommand) => {
      if (
        !commandScope.isCurrent(command) ||
        sessionRef.current !== sessionKey ||
        !authoritativeContextReady
      )
        throw new HttpError('Approval request context is not current.', 409);
      const persisted = await autosave.flush();
      if (
        !commandScope.isCurrent(command) ||
        sessionRef.current !== sessionKey ||
        !currentAuthority.current.authoritativeContextReady ||
        currentAuthority.current.schemaHash !== schemaHash
      )
        throw new HttpError('Approval request identity changed.', 409);
      persistedRef.current = persisted.requestId;
      if (command.input.intent === 'SUBMIT') {
        await userSource.waitForOwner(
          persisted.requestId,
          persisted.version,
          () => commandScope.isCurrent(command) && sessionRef.current === sessionKey
        );
        const currentPreflight = await runPreflight(async (execution) => {
          if (
            !commandScope.isCurrent(command) ||
            sessionRef.current !== sessionKey ||
            !currentAuthority.current.authoritativeContextReady ||
            !currentAuthority.current.submissionReady ||
            !userSource.isReady() ||
            currentAuthority.current.schemaHash !== schemaHash
          )
            throw new HttpError('Approval request identity changed.', 409);
          return preflightApprovalRequest(persisted.requestId, persisted.version, execution);
        });
        if (!currentPreflight.ready)
          throw new HttpError('Approval request preflight is blocked.', 409);
        await runSubmit(async (execution) => {
          if (
            !commandScope.isCurrent(command) ||
            sessionRef.current !== sessionKey ||
            !currentAuthority.current.authoritativeContextReady ||
            !currentAuthority.current.submissionReady ||
            !userSource.isReady() ||
            currentAuthority.current.schemaHash !== schemaHash
          )
            throw new HttpError('Approval request identity changed.', 409);
          const idempotencyKey = command.input.idempotencyKey;
          if (!idempotencyKey) throw new HttpError('Original submission key is missing.', 400);
          submittedAttempt.current = {
            command,
            requestId: persisted.requestId,
            version: persisted.version,
          };
          return submitApprovalRequest(persisted.requestId, persisted.version, execution, {
            idempotencyKey,
          });
        });
      }
      return { command };
    },
    onSuccess: async ({ command }) => {
      if (!commandScope.isCurrent(command) || sessionRef.current !== sessionKey) return;
      setManualRecovery(undefined);
      submittedAttempt.current = undefined;
      setSubmissionUnknown(false);
      setPreflightOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      if (!commandScope.isCurrent(command) || sessionRef.current !== sessionKey) return;
      toast.success(
        t(command.input.intent === 'SUBMIT' ? 'requests.created' : 'requests.draftSaved')
      );
      navigate(
        command.input.intent === 'SUBMIT'
          ? '/approvals/requests/submitted'
          : '/approvals/requests/drafts'
      );
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command) || sessionRef.current !== sessionKey) return;
      setPreflightOpen(false);
      const unknown =
        submittedAttempt.current?.command === command && approvalRequestCommandResultUnknown(error);
      if (unknown) {
        setSubmissionUnknown(true);
        setManualRecovery({ kind: 'UNKNOWN', latestLoaded: false });
      } else if (isProductSurfaceOperationCancelledError(error)) return;
      else submittedAttempt.current = undefined;
      if (command.input.intent === 'SUBMIT' && error instanceof HttpError && error.status === 409) {
        autosave.controller.markConflict();
      }
      if (
        !unknown &&
        !['CONFLICT', 'DENIED', 'UNAVAILABLE', 'UNKNOWN', 'ERROR'].includes(
          autosave.controller.getSnapshot().status
        )
      ) {
        setManualRecovery({
          kind: approvalRequestRecovery(error instanceof HttpError ? error.status : undefined),
          latestLoaded: false,
        });
      }
      if (!unknown && command.input.intent === 'SUBMIT' && persistedRef.current && !draftId) {
        navigate(`/approvals/requests/new?draft=${persistedRef.current}`, { replace: true });
      }
      toast.error(t('requests.createError'));
    },
    onSettled: (_, __, command) => {
      if (manualFlight.current === command) manualFlight.current = undefined;
    },
  });

  const refreshContext = async () => {
    const captured = sessionKey;
    try {
      const results = await Promise.all([
        forms.refetch(),
        boundFormId ? template.refetch() : undefined,
        draftId ? draft.refetch() : undefined,
      ]);
      if (
        sessionRef.current !== captured ||
        !commandScope.isCurrent(binding) ||
        results.some((result) => result?.isError)
      )
        return;
      if (submissionUnknown && submittedAttempt.current) {
        const attempt = submittedAttempt.current;
        const latest = await getApprovalRequestDetail(
          attempt.requestId,
          requestScope.contextScopeKey
        );
        if (sessionRef.current !== captured || !commandScope.isCurrent(attempt.command)) return;
        if (
          latest.request.requestId === attempt.requestId &&
          latest.request.version > attempt.version &&
          latest.request.status !== 'DRAFT'
        ) {
          submittedAttempt.current = undefined;
          setSubmissionUnknown(false);
          navigate('/approvals/requests/submitted');
        }
        // A DRAFT read cannot prove that an already dispatched command did not commit.
        return;
      }
      if (autosave.status === 'CONFLICT' && autosave.receipt) {
        const latest = await getApprovalRequestDetail(
          autosave.receipt.requestId,
          requestScope.contextScopeKey
        );
        if (sessionRef.current !== captured || !commandScope.isCurrent(binding)) return;
        autosave.reviewLatestDetail(latest, formEvaluation.compiled?.schemaSha256);
      } else if (manualRecovery?.kind === 'CONFLICT') {
        setManualRecovery({ ...manualRecovery, latestLoaded: true });
      } else {
        setManualRecovery(undefined);
        autosave.resume();
      }
    } catch {
      if (sessionRef.current !== captured || !commandScope.isCurrent(binding)) return;
      toast.error(t('requests.draftLoadError'));
    }
  };

  const reapply = async () => {
    if (submissionUnknown) return;
    try {
      if (autosave.status === 'CONFLICT') {
        const merged = autosave.reviewedInput();
        if (!merged) return;
        const mergedValues = approvalRequestEditingValues(
          merged.payload,
          template.data?.form.schema,
          formEvaluation.compiled
        );
        setFormId(merged.formId);
        setTitle(merged.title);
        setSummary(merged.summary);
        setPriority(merged.priority);
        setPayloadValues(mergedValues);
        await autosave.reapply();
      } else setManualRecovery(undefined);
    } catch {
      /* The merged editor and autosave state retain input and expose the server failure. */
    }
  };
  const requestFormChange = (nextFormId: string) => {
    if (contentMasked || autosave.unresolved || submissionUnknown) return;
    if (nextFormId === formId) return;
    if (!formId) {
      setFormId(nextFormId);
      return;
    }
    setPendingFormId(nextFormId);
  };
  const applyFormChange = () => {
    if (
      contentMasked ||
      autosave.unresolved ||
      submissionUnknown ||
      !pendingFormChange ||
      pendingFormChange.source.formId !== formId ||
      pendingFormChange.target.formId !== pendingFormId
    )
      return;
    setFormId(pendingFormChange.target.formId);
    setPayloadValues({});
    setPendingFormId('');
  };
  const reconcile = async () => {
    const captured = sessionKey;
    const restoreEditor = () => {
      if (
        !quarantined ||
        sessionRef.current !== captured ||
        !commandScope.isCurrent(binding) ||
        !currentAuthority.current.authoritativeContextReady
      )
        return;
      setFormId(quarantined.formId);
      setTitle(quarantined.title);
      setSummary(quarantined.summary);
      setPriority(quarantined.priority);
      setPayloadValues(structuredClone(quarantined.payloadValues));
      setQuarantinedEditor(undefined);
    };
    try {
      await autosave.reconcile();
      restoreEditor();
    } catch {
      const state = autosave.controller.getSnapshot();
      if (state.status === 'CONFLICT' && state.receipt?.status === 'DRAFT') restoreEditor();
    }
  };
  const beginSave = (intent: SaveIntent) => {
    if (manualFlight.current || submittedAttempt.current || submissionUnknown || !contextReady)
      return;
    const command = commandScope.capture(
      Object.freeze({
        intent,
        idempotencyKey: intent === 'SUBMIT' ? crypto.randomUUID() : undefined,
      })
    );
    manualFlight.current = command;
    save.mutate(command);
  };
  const prepareReview = () => {
    if (!reviewReady || preflight.isPending || save.isPending) return;
    if (!submissionReady) {
      setServerPreflight(undefined);
      setPreflightOpen(true);
      return;
    }
    setServerPreflight(undefined);
    preflight.mutate(commandScope.capture(Object.freeze({ intent: 'PREFLIGHT' })));
  };

  return {
    t,
    korean,
    draftId,
    requestScope,
    forms,
    draft,
    template,
    formId: contentMasked ? '' : formId,
    title: contentMasked ? '' : title,
    summary: contentMasked ? '' : summary,
    priority: contentMasked ? ('NORMAL' as const) : priority,
    payloadValues: contentMasked ? {} : payloadValues,
    fields,
    formEvaluation,
    userSource,
    schemaBindingReady,
    missingFields,
    dwaionDraft,
    pendingFormId,
    pendingFormChange,
    preflightOpen,
    serverPreflight,
    preflight,
    recovery,
    submissionUnknown,
    contextReady,
    reviewReady,
    validationIssues,
    contentMasked,
    fieldsDisabled:
      contentMasked ||
      submissionUnknown ||
      save.isPending ||
      (formEvaluation.kind === 'TYPED' && !formEvaluation.schemaReady) ||
      Boolean(draftId && (hydratedDraftId !== draftId || draft.isFetching || draft.isError)),
    submissionReady,
    autosave,
    save,
    refreshContext,
    reapply,
    reconcile,
    setTitle,
    setSummary,
    setPriority,
    setPayloadValues,
    setPendingFormId,
    setPreflightOpen,
    prepareReview,
    requestFormChange,
    applyFormChange,
    saveDraft: () => beginSave('DRAFT'),
    saveAndClose: () => beginSave('CLOSE'),
    submit: () => beginSave('SUBMIT'),
  };
}
