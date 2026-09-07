import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Braces,
  Eye,
  FileCheck2,
  FilePlus2,
  GitBranch,
  MessageSquareReply,
  Pencil,
  Save,
  Send,
  Undo2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  ActionIconButton,
  DatePickerField,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';
import {
  createApprovalRequest,
  dwaionHandoffText,
  getApprovalRequestDetail,
  getApprovalRequests,
  getPublishedApprovalFormTemplate,
  getPublishedApprovalForms,
  parseDwaionHandoff,
  respondToApprovalInformationRequest,
  submitApprovalRequest,
  updateApprovalDraft,
  useToast,
  withdrawApprovalRequest,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { ApprovalSurface, PriorityChip, StatusChip } from './approval-ui';
import {
  ApprovalQueryErrorAlert,
  PublishedApprovalFormSelector,
  PublishedApprovalTemplateSummary,
} from './approval-request-form-context';
import { ApprovalRequestDetailDrawer } from './approval-request-detail-drawer';
import { ApprovalInformationResponseFields } from './approval-information-response-fields';
import { useApprovalExperience } from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';

import type {
  ApprovalFormField,
  ApprovalPriority,
  ApprovalRequest,
} from '@dwp-frontend/shared-utils';

const viewMap = {
  drafts: 'DRAFTS',
  submitted: 'SUBMITTED',
  'needs-info': 'NEEDS_INFO',
  archive: 'ARCHIVE',
} as const;

export function ApprovalRequests({ view }: { view: 'new' | keyof typeof viewMap }) {
  return view === 'new' ? <NewApprovalRequest /> : <ApprovalRequestList view={view} />;
}

function NewApprovalRequest() {
  const { t, i18n } = useTranslation('approvals');
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const draftId = searchParams.get('draft');
  const forms = useQuery({
    queryKey: ['approvals', 'forms', 'published'],
    queryFn: getPublishedApprovalForms,
    staleTime: 60_000,
    retry: 1,
  });
  const [formId, setFormId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState<ApprovalPriority>('NORMAL');
  const [payloadValues, setPayloadValues] = useState<Record<string, string>>({});
  const [hydratedDraftId, setHydratedDraftId] = useState('');
  const [dwaionDraft, setDwaionDraft] = useState(false);
  const dwaionHandoff = useMemo(
    () => parseDwaionHandoff(location.state, 'APPROVAL.REQUEST.CREATE'),
    [location.state]
  );
  const draft = useQuery({
    queryKey: ['approvals', 'requests', 'detail', draftId],
    queryFn: () => getApprovalRequestDetail(draftId!),
    enabled: Boolean(draftId),
    staleTime: 0,
    retry: 1,
  });
  const template = useQuery({
    queryKey: ['approvals', 'forms', 'published', formId, 'template'],
    queryFn: () => getPublishedApprovalFormTemplate(formId),
    enabled: Boolean(formId),
    staleTime: 60_000,
    retry: 1,
  });
  useEffect(() => {
    if (!draftId || !draft.data || hydratedDraftId === draftId) return;
    setFormId(draft.data.formId);
    setTitle(draft.data.request.title);
    setSummary(draft.data.request.summary);
    setPriority(draft.data.request.priority);
    setPayloadValues(
      Object.fromEntries(
        Object.entries(draft.data.payload)
          .filter(([key, value]) => !['summary', 'createdFrom'].includes(key) && value != null)
          .map(([key, value]) => [key, String(value)])
      )
    );
    setHydratedDraftId(draftId);
  }, [draft.data, draftId, hydratedDraftId]);
  useEffect(() => {
    if (draftId || !dwaionHandoff) return;
    const handoffTitle = dwaionHandoffText(dwaionHandoff, 'title');
    const handoffSummary = dwaionHandoffText(dwaionHandoff, 'businessJustification');
    const handoffForm = dwaionHandoffText(dwaionHandoff, 'formType');
    if (handoffTitle) setTitle(handoffTitle);
    if (handoffSummary) setSummary(handoffSummary);
    if (handoffForm && forms.data?.some((form) => form.formId === handoffForm)) {
      setFormId(handoffForm);
    }
    setDwaionDraft(true);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null }
    );
  }, [draftId, dwaionHandoff, forms.data, location.pathname, location.search, navigate]);
  const fields = (template.data?.form.schema.fields ?? []).filter(
    (field) => field.key !== 'summary'
  );
  const requiredFieldsComplete = fields
    .filter((field) => field.required)
    .every((field) => payloadValues[field.key]?.trim());
  const requestContextReady =
    Boolean(formId) &&
    Boolean(template.data) &&
    !forms.isError &&
    !draft.isLoading &&
    !draft.isError &&
    (!draftId || Boolean(draft.data)) &&
    !template.isLoading &&
    !template.isError;
  const submissionReady =
    requestContextReady &&
    title.trim().length >= 2 &&
    summary.trim().length >= 2 &&
    requiredFieldsComplete;
  const runCreate = useApprovalGovernedMutation('route.approvals.work.request-create.action');
  const runUpdate = useApprovalGovernedMutation('route.approvals.work.request-draft-update.action');
  const runSubmit = useApprovalGovernedMutation('route.approvals.work.request-submit.action');
  const save = useMutation({
    mutationFn: async (intent: 'DRAFT' | 'SUBMIT') => {
      const input = {
        workflowId: template.data!.workflow.workflowId,
        formId,
        title: title.trim(),
        summary: summary.trim(),
        priority,
        payload: {
          summary: summary.trim(),
          ...Object.fromEntries(
            Object.entries(payloadValues).filter(([, value]) => value.trim().length > 0)
          ),
          createdFrom: 'DWP_APPROVALS',
        },
      };
      const persisted = draftId
        ? (
            await runUpdate((execution) =>
              updateApprovalDraft(
                draftId,
                {
                  ...input,
                  expectedVersion: draft.data!.request.version,
                },
                execution
              )
            )
          ).request
        : await runCreate((execution) => createApprovalRequest(input, execution));
      return intent === 'SUBMIT'
        ? {
            request: await runSubmit((execution) =>
              submitApprovalRequest(persisted.requestId, persisted.version, execution)
            ),
            intent,
          }
        : { request: persisted, intent };
    },
    onSuccess: async ({ intent }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvals', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
      ]);
      toast.success(t(intent === 'SUBMIT' ? 'requests.created' : 'requests.draftSaved'));
      navigate(
        intent === 'SUBMIT' ? '/approvals/requests/submitted' : '/approvals/requests/drafts'
      );
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('requests.createError')),
  });

  return (
    <Box
      sx={{
        mt: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(300px, .6fr)' },
        gap: 2,
      }}
    >
      <ApprovalSurface
        title={t(draftId ? 'requests.compose.editTitle' : 'requests.compose.title')}
        meta={t(draftId ? 'requests.compose.editMeta' : 'requests.compose.meta')}
      >
        <Stack
          component="form"
          gap={2}
          sx={{ p: { xs: 2, md: 3 } }}
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate('SUBMIT');
          }}
        >
          {dwaionDraft && <Alert severity="info">{t('requests.compose.dwaionDraftNotice')}</Alert>}
          {forms.isError && (
            <ApprovalQueryErrorAlert
              message={t('requests.formsLoadError')}
              retryLabel={t('actions.retry')}
              retrying={forms.isFetching}
              onRetry={() => void forms.refetch()}
            />
          )}
          {draft.isError && (
            <ApprovalQueryErrorAlert
              message={t('requests.draftLoadError')}
              retryLabel={t('actions.retry')}
              retrying={draft.isFetching}
              onRetry={() => void draft.refetch()}
            />
          )}
          <PublishedApprovalFormSelector
            forms={forms.data ?? []}
            value={formId}
            label={t('requests.fields.form')}
            korean={i18n.resolvedLanguage?.startsWith('ko') ?? false}
            disabled={forms.isLoading || forms.isError}
            onChange={(nextFormId) => {
              setFormId(nextFormId);
              setPayloadValues({});
            }}
          />
          {template.isError && (
            <ApprovalQueryErrorAlert
              message={t('requests.templateError')}
              retryLabel={t('actions.retry')}
              retrying={template.isFetching}
              onRetry={() => void template.refetch()}
            />
          )}
          {template.data && (
            <PublishedApprovalTemplateSummary
              processLabel={t('requests.template.process')}
              processValue={
                i18n.resolvedLanguage?.startsWith('ko')
                  ? template.data.workflow.nameKo
                  : template.data.workflow.nameEn
              }
              slaLabel={t('requests.template.sla')}
              slaValue={t('admin.minutes', { count: template.data.workflow.slaMinutes })}
              formLabel={t('requests.template.form')}
              formValue={t('requests.template.formVersion', {
                version: template.data.form.form.currentVersion,
                count: template.data.form.form.fieldCount,
              })}
            />
          )}
          <FormField
            required
            label={t('requests.fields.title')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            inputProps={{ maxLength: 300 }}
          />
          <FormField
            required
            multiline
            minRows={6}
            label={t('requests.fields.summary')}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            inputProps={{ maxLength: 2000 }}
            supportingText={t('requests.fields.summaryHelp')}
          />
          <FormControl fullWidth>
            <InputLabel id="approval-request-priority-label">
              {t('requests.fields.priority')}
            </InputLabel>
            <Select
              id="approval-request-priority"
              labelId="approval-request-priority-label"
              label={t('requests.fields.priority')}
              value={priority}
              onChange={(event) => setPriority(event.target.value as ApprovalPriority)}
            >
              {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`priority.${value}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {fields.length > 0 && (
            <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, display: 'grid', gap: 1.5 }}>
              <Stack direction="row" gap={1} alignItems="center">
                <Braces size={17} color="#2856C7" />
                <Typography component="legend" variant="subtitle2">
                  {t('requests.template.businessFields')}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('requests.template.fieldCount', { count: fields.length })}
                />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                {fields.map((field) => {
                  const korean = i18n.resolvedLanguage?.startsWith('ko');
                  const label = korean
                    ? (field.labelKo ?? field.key)
                    : (field.labelEn ?? field.key);
                  const help = korean ? field.helpKo : field.helpEn;
                  const setValue = (value: string) =>
                    setPayloadValues((current) => ({ ...current, [field.key]: value }));
                  if (field.type === 'SELECT') {
                    const labelId = `approval-request-${field.key}-label`;
                    return (
                      <FormControl key={field.key} fullWidth required={field.required}>
                        <InputLabel id={labelId}>{label}</InputLabel>
                        <Select
                          id={`approval-request-${field.key}`}
                          labelId={labelId}
                          label={label}
                          value={payloadValues[field.key] ?? ''}
                          onChange={(event) => setValue(event.target.value)}
                        >
                          {(field.options ?? []).map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          {help || t('requests.template.fieldHelp.SELECT')}
                        </FormHelperText>
                      </FormControl>
                    );
                  }
                  if (field.type === 'DATE') {
                    return (
                      <DatePickerField
                        key={field.key}
                        required={field.required}
                        label={label}
                        value={payloadValues[field.key] || null}
                        onValueChange={(value) => setValue(value ?? '')}
                        supportingText={help}
                      />
                    );
                  }
                  return (
                    <FormField
                      key={field.key}
                      required={field.required}
                      multiline={field.type === 'TEXTAREA'}
                      minRows={field.type === 'TEXTAREA' ? 3 : undefined}
                      type={field.type === 'NUMBER' ? 'number' : 'text'}
                      label={label}
                      value={payloadValues[field.key] ?? ''}
                      onChange={(event) => setValue(event.target.value)}
                      supportingText={
                        help ||
                        (field.type === 'USER' ? t('requests.template.fieldHelp.USER') : undefined)
                      }
                    />
                  );
                })}
              </Box>
            </Box>
          )}
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="flex-end" gap={1}>
            <ActionButton
              type="button"
              intent="secondary"
              startIcon={<Save size={17} />}
              loading={save.isPending && save.variables === 'DRAFT'}
              disabled={!requestContextReady}
              onClick={() => save.mutate('DRAFT')}
            >
              {t('actions.saveDraft')}
            </ActionButton>
            <ActionButton
              type="submit"
              intent="primary"
              startIcon={<Send size={17} />}
              loading={save.isPending && save.variables === 'SUBMIT'}
              disabled={!submissionReady}
            >
              {t('actions.submitRequest')}
            </ActionButton>
          </Stack>
        </Stack>
      </ApprovalSurface>
      <Stack gap={2} alignSelf="start">
        {template.data && (
          <ApprovalSurface
            title={t('requests.route.title')}
            meta={t('requests.route.meta', { count: template.data.workflow.currentVersion })}
          >
            <Stack gap={1.25} sx={{ p: 2 }}>
              <Stack direction="row" gap={1} alignItems="center">
                <GitBranch size={19} color="#2856C7" />
                <Typography variant="body2" fontWeight={760}>
                  {i18n.resolvedLanguage?.startsWith('ko')
                    ? template.data.workflow.nameKo
                    : template.data.workflow.nameEn}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {i18n.resolvedLanguage?.startsWith('ko')
                  ? template.data.workflow.descriptionKo
                  : template.data.workflow.descriptionEn}
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                <Chip size="small" variant="outlined" label={template.data.workflow.category} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={template.data.workflow.dataClassification}
                />
              </Stack>
              <Box
                component="ol"
                aria-label={t('requests.route.steps')}
                sx={{ m: 0, mt: 0.75, p: 0, listStyle: 'none', display: 'grid', gap: 0.75 }}
              >
                {template.data.routeDefinition.steps.map((step, index) => (
                  <Stack
                    component="li"
                    key={step.key}
                    direction="row"
                    gap={1}
                    alignItems="center"
                    sx={{ minHeight: 50, px: 1.25, border: 1, borderColor: 'divider' }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        flex: '0 0 auto',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'primary.lighter',
                        color: 'primary.dark',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Box minWidth={0} flex={1}>
                      <Typography variant="body2" fontWeight={720} noWrap>
                        {step.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {t('requests.route.stepMeta', {
                          role: step.candidateRole,
                          minutes: step.slaMinutes,
                        })}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            </Stack>
          </ApprovalSurface>
        )}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
          <FileCheck2 size={27} color="#2856C7" />
          <Typography component="p" variant="subtitle1" fontWeight={760} sx={{ mt: 1.5 }}>
            {t('requests.assurance.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {t('requests.assurance.description')}
          </Typography>
          <Stack gap={1} sx={{ mt: 2 }}>
            {['identity', 'policy', 'evidence', 'concurrency'].map((key) => (
              <Stack key={key} direction="row" gap={1} alignItems="center">
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
                <Typography variant="caption">{t(`requests.assurance.${key}`)}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

function ApprovalRequestList({ view }: { view: keyof typeof viewMap }) {
  const { t, i18n } = useTranslation('approvals');
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('request');
  const openedRequestRef = useRef<string | undefined>(undefined);
  const { canUpdateRequests } = useApprovalExperience();
  const queryClient = useQueryClient();
  const [requestAction, setRequestAction] = useState<{
    kind: 'respond' | 'withdraw';
    request: ApprovalRequest;
  }>();
  const [responseMessage, setResponseMessage] = useState('');
  const [responsePayload, setResponsePayload] = useState<Record<string, string>>({});
  const [responseHydratedRevision, setResponseHydratedRevision] = useState('');
  const [detailId, setDetailId] = useState<string>();
  const closeDetail = () => {
    setDetailId(undefined);
    if (requestedId) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete('request');
          return next;
        },
        { replace: true }
      );
    }
  };
  const requests = useQuery({
    queryKey: ['approvals', 'requests', viewMap[view]],
    queryFn: () => getApprovalRequests(viewMap[view]),
    staleTime: 20_000,
    retry: 1,
  });
  useEffect(() => {
    if (!requestedId) {
      openedRequestRef.current = undefined;
      return;
    }
    if (
      openedRequestRef.current === requestedId ||
      !requests.data?.some((item) => item.requestId === requestedId)
    ) {
      return;
    }
    openedRequestRef.current = requestedId;
    setDetailId(requestedId);
  }, [requestedId, requests.data]);
  const informationDetail = useQuery({
    queryKey: ['approvals', 'requests', 'information-response', requestAction?.request.requestId],
    queryFn: () => getApprovalRequestDetail(requestAction!.request.requestId),
    enabled: requestAction?.kind === 'respond',
    staleTime: 0,
    retry: 1,
  });
  const reviewedInformationDetail =
    informationDetail.isError || informationDetail.isFetching ? undefined : informationDetail.data;
  useEffect(() => {
    const detail = reviewedInformationDetail;
    const revision = detail ? `${detail.request.requestId}:${detail.request.version}` : '';
    if (!detail || responseHydratedRevision === revision) return;
    setResponsePayload(
      Object.fromEntries(
        Object.entries(detail.payload)
          .filter(([key, value]) => key !== 'createdFrom' && value != null)
          .map(([key, value]) => [key, String(value)])
      )
    );
    setResponseHydratedRevision(revision);
  }, [responseHydratedRevision, reviewedInformationDetail]);
  const responseFields = useMemo(() => {
    const schemaFields = reviewedInformationDetail?.formSchema?.fields ?? [];
    const schemaKeys = new Set(schemaFields.map((field) => field.key));
    const legacyFields = Object.keys(responsePayload)
      .filter((key) => key !== 'createdFrom' && !schemaKeys.has(key))
      .map<ApprovalFormField>((key) => ({
        key,
        type: key === 'summary' ? 'TEXTAREA' : 'TEXT',
        required: false,
      }));
    return [...schemaFields, ...legacyFields];
  }, [responsePayload, reviewedInformationDetail?.formSchema?.fields]);
  const responseRequiredFieldsComplete = responseFields
    .filter((field) => field.required)
    .every((field) => responsePayload[field.key]?.trim());
  const requestActionsReady = canUpdateRequests && !requests.isFetching && !requests.isError;
  const actionRequestIsCurrent = (request: ApprovalRequest) => {
    if (!requestActionsReady) return false;
    const current = requests.data?.find((candidate) => candidate.requestId === request.requestId);
    return current?.version === request.version && current.status === request.status;
  };
  const runSubmit = useApprovalGovernedMutation('route.approvals.work.request-submit.action');
  const runRespond = useApprovalGovernedMutation(
    'route.approvals.work.request-information-response.action'
  );
  const runWithdraw = useApprovalGovernedMutation('route.approvals.work.request-withdraw.action');
  const submit = useMutation({
    mutationFn: ({ requestId, version }: { requestId: string; version: number }) => {
      const current = requests.data?.find((candidate) => candidate.requestId === requestId);
      if (
        !requestActionsReady ||
        !current ||
        current.version !== version ||
        current.status !== 'DRAFT'
      ) {
        throw new Error('Approval request authority is not current.');
      }
      return runSubmit((execution) => submitApprovalRequest(requestId, version, execution));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvals', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
      ]);
      toast.success(t('requests.submitted'));
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('requests.submitError')),
  });
  const act = useMutation({
    mutationFn: async (action: NonNullable<typeof requestAction>) => {
      if (!actionRequestIsCurrent(action.request)) {
        throw new Error('Approval request authority is not current.');
      }
      if (action.kind === 'respond') {
        const reviewed = reviewedInformationDetail;
        if (
          !reviewed ||
          reviewed.request.requestId !== action.request.requestId ||
          reviewed.request.status !== 'NEEDS_INFO'
        ) {
          throw new Error('Approval information context is not loaded.');
        }
        return runRespond((execution) =>
          respondToApprovalInformationRequest(
            reviewed.request.requestId,
            responseMessage.trim(),
            responsePayload,
            reviewed.request.version,
            execution
          )
        );
      }
      return runWithdraw((execution) =>
        withdrawApprovalRequest(action.request.requestId, action.request.version, execution)
      );
    },
    onSuccess: async (_result, action) => {
      setRequestAction(undefined);
      setResponseMessage('');
      setResponsePayload({});
      setResponseHydratedRevision('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvals', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
      ]);
      toast.success(
        t(action.kind === 'respond' ? 'requests.informationResponded' : 'requests.withdrawn')
      );
    },
    onError: (error) =>
      !isProductSurfaceOperationCancelledError(error) && toast.error(t('requests.actionError')),
  });
  if (requests.isError)
    return (
      <Alert
        severity="error"
        sx={{ mt: 3 }}
        action={
          <ActionButton
            type="button"
            intent="quiet"
            size="small"
            disabled={requests.isFetching}
            onClick={() => void requests.refetch()}
          >
            {t('actions.retry')}
          </ActionButton>
        }
      >
        {t('requests.loadError')}
      </Alert>
    );
  return (
    <ApprovalSurface
      title={t(`requests.views.${view}.title`)}
      meta={t(`requests.views.${view}.meta`, { count: requests.data?.length ?? 0 })}
      action={<Chip size="small" label={requests.data?.length ?? 0} />}
    >
      <TableContainer sx={{ minHeight: 360 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('requests.columns.request')}</TableCell>
              <TableCell>{t('requests.columns.workflow')}</TableCell>
              <TableCell>{t('requests.columns.priority')}</TableCell>
              <TableCell>{t('requests.columns.status')}</TableCell>
              <TableCell>{t('requests.columns.due')}</TableCell>
              <TableCell align="right">{t('requests.columns.action')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(requests.data ?? []).map((request) => (
              <TableRow
                key={request.requestId}
                hover
                selected={requestedId === request.requestId}
                sx={{ height: 76 }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={740}>
                    {request.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {request.requestNumber}
                  </Typography>
                  {request.status === 'NEEDS_INFO' && request.latestInformationRequest && (
                    <Stack direction="row" gap={0.65} alignItems="flex-start" sx={{ mt: 0.75 }}>
                      <MessageSquareReply size={14} color="#B45309" style={{ marginTop: 2 }} />
                      <Typography
                        variant="caption"
                        color="warning.dark"
                        sx={{
                          maxWidth: 380,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {request.latestInformationRequest}
                      </Typography>
                    </Stack>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {i18n.resolvedLanguage?.startsWith('ko')
                      ? request.workflowNameKo
                      : request.workflowNameEn}
                  </Typography>
                  {request.currentStepName && (
                    <Typography variant="caption" color="primary.main">
                      {t('requests.currentStep', {
                        name: request.currentStepName,
                        current: request.currentStepSequence,
                        total: request.totalSteps,
                      })}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <PriorityChip priority={request.priority} />
                </TableCell>
                <TableCell>
                  <StatusChip status={request.status} />
                </TableCell>
                <TableCell>
                  {request.dueAt ? formatDate(request.dueAt, { dateStyle: 'medium' }) : '-'}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" gap={0.75} justifyContent="flex-end" alignItems="center">
                    <ActionIconButton
                      label={t('actions.openDetails')}
                      tooltip={t('actions.openDetails')}
                      size="small"
                      onClick={() => setDetailId(request.requestId)}
                    >
                      <Eye size={17} />
                    </ActionIconButton>
                    {requestActionsReady && request.status === 'DRAFT' && (
                      <>
                        <ActionButton
                          intent="secondary"
                          size="small"
                          startIcon={<Pencil size={15} />}
                          onClick={() =>
                            navigate(`/approvals/requests/new?draft=${request.requestId}`)
                          }
                        >
                          {t('actions.edit')}
                        </ActionButton>
                        <ActionButton
                          intent="primary"
                          size="small"
                          startIcon={<Send size={15} />}
                          loading={submit.isPending}
                          onClick={() =>
                            submit.mutate({
                              requestId: request.requestId,
                              version: request.version,
                            })
                          }
                        >
                          {t('actions.submit')}
                        </ActionButton>
                      </>
                    )}
                    {requestActionsReady && request.status === 'NEEDS_INFO' && (
                      <ActionButton
                        intent="primary"
                        size="small"
                        startIcon={<MessageSquareReply size={15} />}
                        onClick={() => setRequestAction({ kind: 'respond', request })}
                      >
                        {t('actions.respondInfo')}
                      </ActionButton>
                    )}
                    {requestActionsReady && ['SUBMITTED', 'IN_REVIEW'].includes(request.status) && (
                      <ActionButton
                        intent="secondary"
                        size="small"
                        startIcon={<Undo2 size={15} />}
                        onClick={() => setRequestAction({ kind: 'withdraw', request })}
                      >
                        {t('actions.withdraw')}
                      </ActionButton>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {!requests.isLoading && requests.data?.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <FilePlus2 size={32} color="#728096" />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            {t('requests.empty')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('requests.emptyDescription')}
          </Typography>
        </Box>
      )}
      <FormDialog
        open={Boolean(requestAction)}
        title={t(`requests.dialog.${requestAction?.kind ?? 'respond'}.title`)}
        description={t(`requests.dialog.${requestAction?.kind ?? 'respond'}.description`, {
          title: requestAction?.request.title,
        })}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(`requests.dialog.${requestAction?.kind ?? 'respond'}.confirm`)}
        submitIntent={requestAction?.kind === 'withdraw' ? 'danger' : 'primary'}
        busy={act.isPending}
        submitDisabled={
          !requestActionsReady ||
          !requestAction ||
          !actionRequestIsCurrent(requestAction.request) ||
          (requestAction.kind === 'respond' &&
            (responseMessage.trim().length < 4 ||
              informationDetail.isFetching ||
              informationDetail.isError ||
              !reviewedInformationDetail ||
              !responseRequiredFieldsComplete))
        }
        onClose={() => {
          setRequestAction(undefined);
          setResponseMessage('');
          setResponsePayload({});
          setResponseHydratedRevision('');
        }}
        onSubmit={() => {
          if (!requestAction || !actionRequestIsCurrent(requestAction.request)) return;
          act.mutate(requestAction);
        }}
      >
        {requestAction?.kind === 'respond' && (
          <Stack gap={2}>
            {requestAction.request.latestInformationRequest && (
              <Alert severity="warning" icon={<MessageSquareReply size={18} />}>
                {requestAction.request.latestInformationRequest}
              </Alert>
            )}
            <ApprovalInformationResponseFields
              responseMessage={responseMessage}
              responsePayload={responsePayload}
              responseFields={responseFields}
              detailReady={Boolean(reviewedInformationDetail)}
              korean={i18n.resolvedLanguage?.startsWith('ko') ?? false}
              detailStatus={
                informationDetail.isFetching ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('requests.amendmentLoading')}
                  </Typography>
                ) : informationDetail.isError ? (
                  <Alert
                    severity="error"
                    action={
                      <ActionButton
                        type="button"
                        intent="quiet"
                        size="small"
                        onClick={() => void informationDetail.refetch()}
                      >
                        {t('actions.retry')}
                      </ActionButton>
                    }
                  >
                    {t('requests.draftLoadError')}
                  </Alert>
                ) : undefined
              }
              onResponseMessageChange={setResponseMessage}
              onResponsePayloadChange={(key, value) =>
                setResponsePayload((current) => ({ ...current, [key]: value }))
              }
            />
          </Stack>
        )}
        {requestAction?.kind === 'withdraw' && (
          <Alert severity="warning">{t('requests.withdrawNotice')}</Alert>
        )}
      </FormDialog>
      <ApprovalRequestDetailDrawer
        requestId={detailId}
        canUpdateRequests={requestActionsReady}
        onClose={closeDetail}
        onRespond={(request) => {
          closeDetail();
          setRequestAction({ kind: 'respond', request });
        }}
        onWithdraw={(request) => {
          closeDetail();
          setRequestAction({ kind: 'withdraw', request });
        }}
      />
    </ApprovalSurface>
  );
}
