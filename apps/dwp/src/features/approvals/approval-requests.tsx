import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Braces,
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
import { ActionButton, DatePickerField, FormDialog, FormField } from '@dwp-frontend/design-system';
import {
  createApprovalRequest,
  getApprovalRequest,
  getApprovalRequestDetail,
  getApprovalRequests,
  getPublishedApprovalWorkflowTemplate,
  getPublishedApprovalWorkflows,
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

import type { ApprovalPriority, ApprovalRequest } from '@dwp-frontend/shared-utils';

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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const draftId = searchParams.get('draft');
  const workflows = useQuery({
    queryKey: ['approvals', 'workflows', 'published'],
    queryFn: getPublishedApprovalWorkflows,
    staleTime: 60_000,
  });
  const [workflowId, setWorkflowId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState<ApprovalPriority>('NORMAL');
  const [payloadValues, setPayloadValues] = useState<Record<string, string>>({});
  const [hydratedDraftId, setHydratedDraftId] = useState('');
  const draft = useQuery({
    queryKey: ['approvals', 'requests', 'detail', draftId],
    queryFn: () => getApprovalRequestDetail(draftId!),
    enabled: Boolean(draftId),
    staleTime: 0,
  });
  const template = useQuery({
    queryKey: ['approvals', 'workflows', 'published', workflowId, 'template'],
    queryFn: () => getPublishedApprovalWorkflowTemplate(workflowId),
    enabled: Boolean(workflowId),
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!draftId || !draft.data || hydratedDraftId === draftId) return;
    setWorkflowId(draft.data.workflowId);
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
  const fields = (template.data?.form.schema.fields ?? []).filter(
    (field) => field.key !== 'summary'
  );
  const requiredFieldsComplete = fields
    .filter((field) => field.required)
    .every((field) => payloadValues[field.key]?.trim());
  const save = useMutation({
    mutationFn: async (intent: 'DRAFT' | 'SUBMIT') => {
      const input = {
        workflowId,
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
            await updateApprovalDraft(draftId, {
              ...input,
              expectedVersion: draft.data!.request.version,
            })
          ).request
        : await createApprovalRequest(input);
      return intent === 'SUBMIT'
        ? {
            request: await submitApprovalRequest(persisted.requestId, persisted.version),
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
    onError: () => toast.error(t('requests.createError')),
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
          {draft.isError && <Alert severity="error">{t('requests.draftLoadError')}</Alert>}
          <FormControl fullWidth required>
            <InputLabel>{t('requests.fields.workflow')}</InputLabel>
            <Select
              label={t('requests.fields.workflow')}
              value={workflowId}
              onChange={(event) => {
                setWorkflowId(event.target.value);
                setPayloadValues({});
              }}
            >
              {(workflows.data ?? []).map((workflow) => (
                <MenuItem key={workflow.workflowId} value={workflow.workflowId}>
                  {i18n.resolvedLanguage?.startsWith('ko') ? workflow.nameKo : workflow.nameEn}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {template.isError && <Alert severity="error">{t('requests.templateError')}</Alert>}
          {template.data && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              {[
                [
                  t('requests.template.process'),
                  i18n.resolvedLanguage?.startsWith('ko')
                    ? template.data.workflow.nameKo
                    : template.data.workflow.nameEn,
                ],
                [
                  t('requests.template.sla'),
                  t('admin.minutes', { count: template.data.workflow.slaMinutes }),
                ],
                [
                  t('requests.template.form'),
                  t('requests.template.formVersion', {
                    version: template.data.form.form.currentVersion,
                    count: template.data.form.form.fieldCount,
                  }),
                ],
              ].map(([label, value]) => (
                <Box key={label} sx={{ p: 1.5, borderRight: { sm: 1 }, borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body2" fontWeight={740} sx={{ mt: 0.35 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
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
            <InputLabel>{t('requests.fields.priority')}</InputLabel>
            <Select
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
                    return (
                      <FormControl key={field.key} fullWidth required={field.required}>
                        <InputLabel>{label}</InputLabel>
                        <Select
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
              disabled={
                !workflowId ||
                draft.isLoading ||
                (Boolean(draftId) && !draft.data) ||
                template.isLoading ||
                title.trim().length < 2 ||
                summary.trim().length < 2 ||
                !requiredFieldsComplete
              }
              onClick={() => save.mutate('DRAFT')}
            >
              {t('actions.saveDraft')}
            </ActionButton>
            <ActionButton
              type="submit"
              intent="primary"
              startIcon={<Send size={17} />}
              loading={save.isPending && save.variables === 'SUBMIT'}
              disabled={
                !workflowId ||
                draft.isLoading ||
                (Boolean(draftId) && !draft.data) ||
                template.isLoading ||
                title.trim().length < 2 ||
                summary.trim().length < 2 ||
                !requiredFieldsComplete
              }
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
            </Stack>
          </ApprovalSurface>
        )}
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
          <FileCheck2 size={27} color="#2856C7" />
          <Typography variant="subtitle1" fontWeight={760} sx={{ mt: 1.5 }}>
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
  const queryClient = useQueryClient();
  const [requestAction, setRequestAction] = useState<{
    kind: 'respond' | 'withdraw';
    request: ApprovalRequest;
  }>();
  const [responseMessage, setResponseMessage] = useState('');
  const requests = useQuery({
    queryKey: ['approvals', 'requests', viewMap[view]],
    queryFn: () => getApprovalRequests(viewMap[view]),
    staleTime: 20_000,
  });
  const submit = useMutation({
    mutationFn: ({ requestId, version }: { requestId: string; version: number }) =>
      submitApprovalRequest(requestId, version),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvals', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
      ]);
      toast.success(t('requests.submitted'));
    },
    onError: () => toast.error(t('requests.submitError')),
  });
  const act = useMutation({
    mutationFn: async (action: NonNullable<typeof requestAction>) => {
      const latest = await getApprovalRequest(action.request.requestId);
      return action.kind === 'respond'
        ? respondToApprovalInformationRequest(
            latest.requestId,
            responseMessage.trim(),
            latest.version
          )
        : withdrawApprovalRequest(latest.requestId, latest.version);
    },
    onSuccess: async (_result, action) => {
      setRequestAction(undefined);
      setResponseMessage('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['approvals', 'requests'] }),
        queryClient.invalidateQueries({ queryKey: ['approvals', 'home'] }),
      ]);
      toast.success(
        t(action.kind === 'respond' ? 'requests.informationResponded' : 'requests.withdrawn')
      );
    },
    onError: () => toast.error(t('requests.actionError')),
  });
  if (requests.isError)
    return (
      <Alert severity="error" sx={{ mt: 3 }}>
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
              <TableRow key={request.requestId} hover sx={{ height: 76 }}>
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
                  {request.status === 'DRAFT' && (
                    <Stack direction="row" gap={0.75} justifyContent="flex-end">
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
                          submit.mutate({ requestId: request.requestId, version: request.version })
                        }
                      >
                        {t('actions.submit')}
                      </ActionButton>
                    </Stack>
                  )}
                  {request.status === 'NEEDS_INFO' && (
                    <ActionButton
                      intent="primary"
                      size="small"
                      startIcon={<MessageSquareReply size={15} />}
                      onClick={() => setRequestAction({ kind: 'respond', request })}
                    >
                      {t('actions.respondInfo')}
                    </ActionButton>
                  )}
                  {['SUBMITTED', 'IN_REVIEW'].includes(request.status) && (
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<Undo2 size={15} />}
                      onClick={() => setRequestAction({ kind: 'withdraw', request })}
                    >
                      {t('actions.withdraw')}
                    </ActionButton>
                  )}
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
        submitDisabled={requestAction?.kind === 'respond' && responseMessage.trim().length < 4}
        onClose={() => {
          setRequestAction(undefined);
          setResponseMessage('');
        }}
        onSubmit={() => requestAction && act.mutate(requestAction)}
      >
        {requestAction?.kind === 'respond' && (
          <Stack gap={2}>
            {requestAction.request.latestInformationRequest && (
              <Alert severity="warning" icon={<MessageSquareReply size={18} />}>
                {requestAction.request.latestInformationRequest}
              </Alert>
            )}
            <FormField
              autoFocus
              required
              multiline
              minRows={4}
              label={t('requests.responseLabel')}
              supportingText={t('requests.responseHelp')}
              value={responseMessage}
              onChange={(event) => setResponseMessage(event.target.value)}
              inputProps={{ maxLength: 2000 }}
            />
          </Stack>
        )}
        {requestAction?.kind === 'withdraw' && (
          <Alert severity="warning">{t('requests.withdrawNotice')}</Alert>
        )}
      </FormDialog>
    </ApprovalSurface>
  );
}
